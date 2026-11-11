import AVFoundation
import VideoToolbox

/// Confined to the media queue; `MediaPipeline` hands it off exactly once, to finish it.
final class SegmentWriter: @unchecked Sendable {
  struct Settings: Sendable {
    var url: URL
    var camera: CaptureConfig.Camera
    var recording: CaptureConfig.Recording
    var rotationAngle: Double
    var audio: AudioTimeline.Configuration
    var callMix: CallAudioMix?
  }

  enum AppendResult: Equatable {
    case appended
    case skipped
    /// Returned once, on the append that broke the writer.
    case failed(Failure)
  }

  private enum State {
    case awaitingFirstFrame, writing, finished
    case failed(String)
  }

  private static let timescale: CMTimeScale = 600

  private let url: URL
  private let audioSampleRate: Double
  private let writer: AVAssetWriter
  private let videoInput: AVAssetWriterInput
  private let audioInput: AVAssetWriterInput
  private let audioFactory: AudioSampleBufferFactory
  private let fps: Int
  private var timeline: AudioTimeline
  private var callMix: CallAudioMix?
  private var state = State.awaitingFirstFrame
  private var span: VideoSpan?
  private var pendingCorrection: Double?
  private var videoStopped = false
  private var audioEnd = 0.0
  private(set) var droppedVideoFrames = 0

  var writtenSec: Double {
    guard case .writing = state else { return 0 }
    return span?.durationSec ?? 0
  }

  var audioCoversVideo: Bool {
    guard case .writing = state, let end = span?.end else { return true }
    return audioEnd >= end.seconds
  }

  var audioDriftSec: Double { timeline.smoothedDrift }
  var audioResyncCount: Int { timeline.resyncCount }
  var hasCallAudio: Bool { callMix?.hasAudio ?? false }
  var callMixSummary: CallAudioMix.Summary? { callMix?.summary }

  init(settings: Settings) throws {
    url = settings.url
    audioSampleRate = settings.audio.sampleRate
    fps = settings.camera.fps
    timeline = AudioTimeline(configuration: settings.audio)
    callMix = settings.callMix
    audioFactory = try AudioSampleBufferFactory(sampleRate: settings.audio.sampleRate)
    do {
      writer = try AVAssetWriter(outputURL: settings.url, fileType: .mov)
    } catch {
      throw Failure(code: .fileWriterFailed, message: error.localizedDescription)
    }
    // Fragments make an unfinished file playable up to the last fragment.
    writer.movieFragmentInterval = CMTime(seconds: settings.recording.fragmentIntervalSec, preferredTimescale: Self.timescale)
    writer.initialMovieFragmentInterval = CMTime(seconds: settings.recording.initialFragmentIntervalSec, preferredTimescale: Self.timescale)

    videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: Self.videoSettings(settings.camera, settings.recording))
    videoInput.expectsMediaDataInRealTime = true
    videoInput.transform = CGAffineTransform(rotationAngle: settings.rotationAngle * .pi / 180)

    audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVNumberOfChannelsKey: 1,
      AVSampleRateKey: settings.audio.sampleRate,
      AVEncoderBitRateKey: settings.recording.audioBitrate,
    ])
    audioInput.expectsMediaDataInRealTime = true

    guard writer.canAdd(videoInput), writer.canAdd(audioInput) else {
      throw Failure(code: .fileWriterFailed, message: "The writer rejected the inputs")
    }
    writer.add(videoInput)
    writer.add(audioInput)
    guard writer.startWriting() else {
      throw Failure(code: .fileWriterFailed, message: writer.error?.localizedDescription ?? "startWriting failed")
    }
  }

  func stopVideo() {
    videoStopped = true
  }

  func appendVideo(_ sampleBuffer: CMSampleBuffer) -> AppendResult {
    guard !videoStopped else { return .skipped }
    let time = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
    switch state {
    case .finished, .failed:
      return .skipped
    case .awaitingFirstFrame:
      writer.startSession(atSourceTime: time)
      span = VideoSpan(start: time, fps: fps)
      state = .writing
    case .writing:
      break
    }
    guard videoInput.isReadyForMoreMediaData else {
      droppedVideoFrames += 1
      return .skipped
    }
    guard videoInput.append(sampleBuffer) else { return .failed(markFailed()) }
    span?.appended(at: time)
    return .appended
  }

  func appendAudio(_ samples: UnsafeBufferPointer<Int16>, firstFrameCaptureTime: Double) -> AppendResult {
    guard case .writing = state else { return .skipped }
    let placement = timeline.place(frameCount: samples.count, firstFrameCaptureTime: firstFrameCaptureTime)
    if let correction = placement.correction { pendingCorrection = correction }
    do {
      if placement.silenceFrames > 0 {
        let silenceStart = placement.presentationTime - Double(placement.silenceFrames) / audioSampleRate
        let silence = try makeSilenceBuffer(frameCount: placement.silenceFrames, at: silenceStart)
        if case .failed(let failure) = append(audio: silence) { return .failed(failure) }
      }
      let kept = UnsafeBufferPointer(rebasing: samples[placement.droppedFrames...])
      let end = placement.presentationTime + Double(kept.count) / audioSampleRate
      // The writer trims audio that starts before the segment; buffers that end before it are skipped.
      guard !kept.isEmpty, let start = span?.start, end > start.seconds else { return .skipped }
      let result = append(audio: try makeAudioBuffer(kept, at: placement.presentationTime))
      if case .appended = result { audioEnd = end }
      return result
    } catch {
      return .failed(markFailed("Audio sample buffer: \(error)"))
    }
  }

  func appendCallAudio(_ samples: UnsafeBufferPointer<Int16>, playsAt: Double) -> Double? {
    guard case .writing = state else { return nil }
    return callMix?.add(samples, playsAt: playsAt) ?? nil
  }

  func takeCorrection() -> Double? {
    defer { pendingCorrection = nil }
    return pendingCorrection
  }

  func finish() async -> SegmentOutcome {
    switch state {
    case .awaitingFirstFrame:
      return discard()
    case .failed(let message):
      // The fragments written so far stay on disk for RecoveryInspector.
      return .failed(message: message)
    case .finished:
      preconditionFailure("A segment is finished once")
    case .writing:
      break
    }
    guard let span, let end = span.end else { return discard() }
    padAudioTail(to: end.seconds, segmentStart: span.start.seconds)
    state = .finished
    writer.endSession(atSourceTime: end)
    videoInput.markAsFinished()
    audioInput.markAsFinished()
    await writer.finishWriting()
    guard writer.status == .completed else {
      return .failed(message: writer.error?.localizedDescription ?? "finishWriting ended with status \(writer.status.rawValue)")
    }
    return .finalized(durationSec: span.durationSec, bytes: url.fileSize)
  }

  private func discard() -> SegmentOutcome {
    writer.cancelWriting()
    state = .finished
    try? FileManager.default.removeItem(at: url)
    return .empty
  }

  private func padAudioTail(to videoEnd: Double, segmentStart: Double) {
    let frames = AudioTail.silenceFrames(audioEnd: audioEnd, videoEnd: videoEnd, segmentStart: segmentStart, sampleRate: audioSampleRate)
    guard frames > 0, let silence = try? makeSilenceBuffer(frameCount: frames, at: audioEnd) else { return }
    if case .appended = append(audio: silence) { audioEnd = videoEnd }
  }

  /// Silence where the microphone has nothing, with the call over it when the file mixes one in.
  private func makeSilenceBuffer(frameCount: Int, at time: Double) throws -> CMSampleBuffer {
    guard callMix != nil else { return try audioFactory.makeSilence(frameCount: frameCount, presentationTime: time) }
    return try [Int16](repeating: 0, count: frameCount).withUnsafeBufferPointer { try makeAudioBuffer($0, at: time) }
  }

  private func makeAudioBuffer(_ mic: UnsafeBufferPointer<Int16>, at time: Double) throws -> CMSampleBuffer {
    guard let mixed = callMix?.mix(mic, at: time) else {
      return try audioFactory.makeBuffer(samples: mic, presentationTime: time)
    }
    return try mixed.withUnsafeBufferPointer { try audioFactory.makeBuffer(samples: $0, presentationTime: time) }
  }

  private func append(audio buffer: CMSampleBuffer) -> AppendResult {
    guard audioInput.isReadyForMoreMediaData else { return .skipped }
    guard audioInput.append(buffer) else { return .failed(markFailed()) }
    return .appended
  }

  private func markFailed(_ reason: String? = nil) -> Failure {
    let message = reason ?? writer.error?.localizedDescription ?? "AVAssetWriter status \(writer.status.rawValue)"
    state = .failed(message)
    return Failure(code: .fileWriterFailed, message: message)
  }

  private static func videoSettings(_ camera: CaptureConfig.Camera, _ recording: CaptureConfig.Recording) -> [String: Any] {
    let isHEVC = recording.codec == .hevc
    return [
      AVVideoCodecKey: isHEVC ? AVVideoCodecType.hevc : AVVideoCodecType.h264,
      AVVideoWidthKey: camera.width,
      AVVideoHeightKey: camera.height,
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: recording.videoBitrate,
        AVVideoExpectedSourceFrameRateKey: camera.fps,
        AVVideoMaxKeyFrameIntervalDurationKey: recording.keyFrameIntervalSec,
        AVVideoProfileLevelKey: isHEVC ? kVTProfileLevel_HEVC_Main_AutoLevel as String : AVVideoProfileLevelH264HighAutoLevel,
      ],
      AVVideoColorPropertiesKey: [
        AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
        AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
        AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
      ],
    ]
  }
}
