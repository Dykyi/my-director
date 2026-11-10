import AVFoundation
import Testing
@testable import CaptureCoreLogic

final class SegmentWriterTests {
  private static let fps = 30
  private static let sampleRate = 48_000.0
  private let directory = Fixtures.temporaryDirectory()
  private var url: URL { directory.appending(path: "segment-001.mov") }

  init() throws {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  }

  deinit {
    try? FileManager.default.removeItem(at: directory)
  }

  private func makeWriter() throws -> SegmentWriter {
    var camera = CaptureConfig.defaults.camera
    camera.width = 320
    camera.height = 240
    camera.fps = Self.fps
    var recording = CaptureConfig.defaults.recording
    recording.codec = .h264
    let audio = AudioTimeline.Configuration(sampleRate: Self.sampleRate, captureLatency: 0, resyncThreshold: 0.04)
    return try SegmentWriter(settings: .init(url: url, camera: camera, recording: recording, rotationAngle: 90, audio: audio))
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

  private func appendFrames(_ count: Int, to writer: SegmentWriter) async throws {
    for index in 0..<count {
      #expect(writer.appendVideo(try frame(at: index)) == .appended)
      try await Task.sleep(for: .milliseconds(5))
    }
  }

  private func appendSilence(seconds: Double, to writer: SegmentWriter) {
    let chunk = [Int16](repeating: 0, count: Int(Self.sampleRate / 10))
    for index in 0..<Int(seconds * 10) {
      chunk.withUnsafeBufferPointer { _ = writer.appendAudio($0, firstFrameCaptureTime: Double(index) / 10) }
    }
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
