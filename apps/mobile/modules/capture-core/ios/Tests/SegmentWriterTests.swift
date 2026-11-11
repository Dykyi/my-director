import AVFoundation
import Testing
@testable import CaptureCoreLogic

final class SegmentWriterTests {
  private static let fps = 30
  private static let sampleRate = 48_000.0
  private static let busyRetries = 200
  private let directory = Fixtures.temporaryDirectory()
  private var url: URL { directory.appending(path: "segment-001.mov") }

  init() throws {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  }

  deinit {
    try? FileManager.default.removeItem(at: directory)
  }

  private func makeWriter(mixesCall: Bool = false) throws -> SegmentWriter {
    var camera = CaptureConfig.defaults.camera
    camera.width = 320
    camera.height = 240
    camera.fps = Self.fps
    var recording = CaptureConfig.defaults.recording
    recording.codec = .h264
    let audio = AudioTimeline.Configuration(sampleRate: Self.sampleRate, captureLatency: 0, resyncThreshold: 0.04)
    let callMix = mixesCall ? CallAudioMix(sampleRate: Self.sampleRate, resyncThreshold: 0.04, gainDb: 0) : nil
    return try SegmentWriter(
      settings: .init(url: url, camera: camera, recording: recording, rotationAngle: 90, audio: audio, callMix: callMix))
  }

  private func frame(at index: Int) throws -> CMSampleBuffer {
    var pixelBuffer: CVPixelBuffer?
    CVPixelBufferCreate(nil, 320, 240, kCVPixelFormatType_420YpCbCr8BiPlanarFullRange, nil, &pixelBuffer)
    let image = try #require(pixelBuffer)
    var format: CMVideoFormatDescription?
    CMVideoFormatDescriptionCreateForImageBuffer(allocator: nil, imageBuffer: image, formatDescriptionOut: &format)
    var timing = CMSampleTimingInfo(
      duration: CMTime(value: 1, timescale: CMTimeScale(Self.fps)),
      presentationTimeStamp: CMTime(value: CMTimeValue(index), timescale: CMTimeScale(Self.fps)),
      decodeTimeStamp: .invalid
    )
    var sample: CMSampleBuffer?
    CMSampleBufferCreateReadyWithImageBuffer(
      allocator: nil, imageBuffer: image, formatDescription: try #require(format), sampleTiming: &timing, sampleBufferOut: &sample)
    return try #require(sample)
  }

  /// Appends with the pacing a camera gives; a frame the busy encoder skipped is offered again.
  private func appendFrames(_ count: Int, to writer: SegmentWriter) async throws {
    for index in 0..<count {
      let sample = try frame(at: index)
      var result = writer.appendVideo(sample)
      for _ in 0..<Self.busyRetries where result == .skipped {
        try await Task.sleep(for: .milliseconds(5))
        result = writer.appendVideo(sample)
      }
      #expect(result == .appended)
      try await Task.sleep(for: .milliseconds(5))
    }
  }

  private func appendSilence(seconds: Double, to writer: SegmentWriter) {
    let chunk = [Int16](repeating: 0, count: Int(Self.sampleRate / 10))
    for index in 0..<Int(seconds * 10) {
      chunk.withUnsafeBufferPointer { _ = writer.appendAudio($0, firstFrameCaptureTime: Double(index) / 10) }
    }
  }

  /// A 1 kHz tone in the call's 10 ms chunks; 480 samples hold whole cycles, so the chunks join cleanly.
  private func appendCallTone(playing times: Range<Double>, into writer: SegmentWriter) {
    let chunk = (0..<480).map { Int16(8_000 * sin(2 * .pi * 1_000 * Double($0) / Self.sampleRate)) }
    for start in stride(from: times.lowerBound, to: times.upperBound, by: 0.01) {
      chunk.withUnsafeBufferPointer { _ = writer.appendCallAudio($0, playsAt: start) }
    }
  }

  private func decodedAudio() async throws -> [Int16] {
    let asset = AVURLAsset(url: url)
    let track = try #require(try await asset.loadTracks(withMediaType: .audio).first)
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVLinearPCMBitDepthKey: 16,
      AVLinearPCMIsFloatKey: false,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsNonInterleaved: false,
      AVSampleRateKey: Self.sampleRate,
      AVNumberOfChannelsKey: 1,
    ])
    reader.add(output)
    reader.startReading()
    var samples: [Int16] = []
    while let buffer = output.copyNextSampleBuffer(), let block = CMSampleBufferGetDataBuffer(buffer) {
      let length = CMBlockBufferGetDataLength(block)
      var chunk = [Int16](repeating: 0, count: length / MemoryLayout<Int16>.size)
      chunk.withUnsafeMutableBytes { _ = CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: length, destination: $0.baseAddress!) }
      samples += chunk
    }
    return samples
  }

  private func levelDb(_ samples: [Int16], from: Double, to: Double) -> Double {
    Array(samples[Int(from * Self.sampleRate)..<Int(to * Self.sampleRate)]).withUnsafeBufferPointer(AudioLevel.rmsDb)
  }

  private func recordCallTone(mixesCall: Bool) async throws -> [Int16] {
    let writer = try makeWriter(mixesCall: mixesCall)
    try await appendFrames(30, to: writer)
    appendCallTone(playing: 0.4..<0.6, into: writer)
    appendSilence(seconds: 1.1, to: writer)
    writer.stopVideo()
    _ = await writer.finish()
    return try await decodedAudio()
  }

  @Test func mixesTheCallIntoTheAudioTrackWhereItPlayed() async throws {
    let audio = try await recordCallTone(mixesCall: true)
    #expect(levelDb(audio, from: 0.45, to: 0.55) > -20)
    #expect(levelDb(audio, from: 0.1, to: 0.3) < -60)
    #expect(levelDb(audio, from: 0.7, to: 0.9) < -60)
  }

  @Test func leavesTheCallOutWithoutAMix() async throws {
    let audio = try await recordCallTone(mixesCall: false)
    #expect(levelDb(audio, from: 0.45, to: 0.55) < -60)
  }

  @Test func aSegmentWithoutFramesIsEmpty() async throws {
    let writer = try makeWriter()
    #expect(await writer.finish() == .empty)
    #expect(!FileManager.default.fileExists(atPath: url.path(percentEncoded: false)))
  }

  @Test func framesAndAudioMakeAFinalizedSegment() async throws {
    let writer = try makeWriter()
    try await appendFrames(30, to: writer)
    appendSilence(seconds: 1.1, to: writer)
    #expect(writer.audioCoversVideo)
    writer.stopVideo()
    guard case .finalized(let durationSec, let bytes) = await writer.finish() else {
      Issue.record("The segment was not finalized")
      return
    }
    #expect(abs(durationSec - 1) < 0.001)
    #expect(bytes > 0)
  }
}

struct VideoSpanTests {
  private let start = CMTime(value: 300, timescale: 30)

  @Test func hasNoEndUntilAFrameIsAppended() {
    let span = VideoSpan(start: start, fps: 30)
    #expect(span.end == nil)
    #expect(span.durationSec == 0)
  }

  @Test func endsOneFrameAfterTheLastFrame() {
    var span = VideoSpan(start: start, fps: 30)
    span.appended(at: start)
    span.appended(at: CMTime(value: 329, timescale: 30))
    #expect(span.end == CMTime(value: 330, timescale: 30))
    #expect(abs(span.durationSec - 1) < 1e-9)
  }
}
