import AVFoundation
import VideoToolbox

final class SegmentWriter: @unchecked Sendable {
  struct Settings: Sendable {
    var url: URL
    var camera: CaptureConfig.Camera
    var recording: CaptureConfig.Recording
    var rotationAngle: Double
    var audio: AudioTimeline.Configuration
  }

  enum AppendResult: Equatable {
    case appended
    case skipped
    case failed(Failure)
  }

  private enum State {
    case awaitingFirstFrame, writing, finished
    case failed(String)
  }

  private static let timescale: CMTimeScale = 600

  let url: URL
  let audioSampleRate: Double
  private let writer: AVAssetWriter
  private let videoInput: AVAssetWriterInput
  private let audioInput: AVAssetWriterInput
  private let audioFactory: AudioSampleBufferFactory
  private let frameDuration: CMTime
  private var timeline: AudioTimeline
  private var state = State.awaitingFirstFrame
  private var firstVideoTime = CMTime.invalid
  private var lastVideoTime = CMTime.invalid
  private var pendingCorrection: Double?
  private var videoStopped = false
  private var audioEnd = 0.0
  private(set) var droppedVideoFrames = 0
  private(set) var droppedAudioBuffers = 0

  var writtenSec: Double {
    guard case .writing = state else { return 0 }
    return (lastVideoTime + frameDuration - firstVideoTime).seconds
  }

  var audioCoversVideo: Bool {
    guard case .writing = state else { return true }
    return audioEnd >= (lastVideoTime + frameDuration).seconds
  }

  var audioDriftSec: Double { timeline.smoothedDrift }
  var audioResyncCount: Int { timeline.resyncCount }

  init(settings: Settings) throws {
    url = settings.url
    audioSampleRate = settings.audio.sampleRate
    frameDuration = CMTime(value: 1, timescale: CMTimeScale(settings.camera.fps))
    timeline = AudioTimeline(configuration: settings.audio)
    audioFactory = try AudioSampleBufferFactory(sampleRate: settings.audio.sampleRate)
    do {
      writer = try AVAssetWriter(outputURL: settings.url, fileType: .mov)
    } catch {
      throw Failure(code: .fileWriterFailed, message: error.localizedDescription)
    }
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
      firstVideoTime = time
      state = .writing
    case .writing:
      break
    }
    guard videoInput.isReadyForMoreMediaData else {
      droppedVideoFrames += 1
      return .skipped
    }
    guard videoInput.append(sampleBuffer) else { return .failed(markFailed()) }
    lastVideoTime = time
    return .appended
  }

  func appendAudio(_ samples: UnsafeBufferPointer<Int16>, arrival: Double) -> AppendResult {
    guard case .writing = state else { return .skipped }
    let placement = timeline.place(frameCount: samples.count, arrival: arrival)
    if let correction = placement.correction { pendingCorrection = correction }
    do {
      if placement.silenceFrames > 0 {
        let silenceStart = placement.presentationTime - Double(placement.silenceFrames) / audioSampleRate
        let silence = try audioFactory.makeSilence(frameCount: placement.silenceFrames, presentationTime: silenceStart)
        if case .failed(let failure) = append(audio: silence) { return .failed(failure) }
      }
      let kept = UnsafeBufferPointer(rebasing: samples[placement.droppedFrames...])
      let end = placement.presentationTime + Double(kept.count) / audioSampleRate
      guard !kept.isEmpty, end > firstVideoTime.seconds else { return .skipped }
      let result = append(audio: try audioFactory.makeBuffer(samples: kept, presentationTime: placement.presentationTime))
      if case .appended = result { audioEnd = end }
      return result
    } catch {
      return .failed(markFailed("Audio sample buffer: \(error)"))
    }
  }

  func takeCorrection() -> Double? {
    defer { pendingCorrection = nil }
    return pendingCorrection
  }

  func finish() async -> SegmentOutcome {
    switch state {
    case .awaitingFirstFrame:
      writer.cancelWriting()
      state = .finished
      try? FileManager.default.removeItem(at: url)
      return .empty
    case .failed(let message):
      return .failed(message: message)
    case .finished:
      preconditionFailure("A segment is finished once")
    case .writing:
      break
    }
    state = .finished
    let end = lastVideoTime + frameDuration
    writer.endSession(atSourceTime: end)
    videoInput.markAsFinished()
    audioInput.markAsFinished()
    await writer.finishWriting()
    guard writer.status == .completed else {
      return .failed(message: writer.error?.localizedDescription ?? "finishWriting ended with status \(writer.status.rawValue)")
    }
    let bytes = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize).flatMap { $0 } ?? 0
    return .finalized(durationSec: (end - firstVideoTime).seconds, bytes: Int64(bytes))
  }

  private func append(audio buffer: CMSampleBuffer) -> AppendResult {
    guard audioInput.isReadyForMoreMediaData else {
      droppedAudioBuffers += 1
      return .skipped
    }
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
