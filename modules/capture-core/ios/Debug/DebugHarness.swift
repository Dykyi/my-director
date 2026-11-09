import AVFoundation
#if canImport(LiveKit)
import LiveKit
#else
import LiveKitClient
#endif

@MainActor
final class DebugHarness {
  let log: EventLog
  let camera = CameraSource()
  let pipeline: MediaPipeline
  private let store: RecordingStore
  private let config = CaptureConfig.defaults
  private let sessionId = SessionId.make(at: Date())
  private var segmentIndex = 0

  nonisolated init() {
    let log = EventLog(subsystem: Bundle.main.bundleIdentifier ?? "CaptureCore", ioQueue: DispatchQueue(label: "capture-core.io"))
    self.log = log
    pipeline = MediaPipeline(log: log) { failure in
      log.error("debug", "Writer failure reported", ["message": failure.message])
    }
    store = RecordingStore(root: URL.documentsDirectory.appending(path: "Recordings", directoryHint: .isDirectory))
  }

  func startCamera() async throws -> [String: String] {
    let startedAt = HostClock.now()
    let report = try await camera.configure(config.camera, frames: pipeline, on: pipeline.queue)
    pipeline.setCaptureClock(camera.synchronizationClock)
    await camera.start()
    let delivering = await pipeline.heartbeats.waitForBeat(.camera, after: startedAt, timeout: config.session.resumeTimeoutMs / 1000)
    log.info("camera", "Camera configured", report.logData.merging(["firstFrame": String(delivering)]) { $1 })
    return report.logData
  }

  func startSegment() async throws -> String {
    segmentIndex += 1
    try FileManager.default.createDirectory(at: store.directory(for: sessionId), withIntermediateDirectories: true)
    let url = store.segmentURL(sessionId: sessionId, index: segmentIndex)
    try await pipeline.openSegment(pipeline.segmentSettings(url: url, config: config, rotationAngle: camera.captureRotationAngle))
    log.info("writer", "Segment opened", ["file": url.lastPathComponent, "rotation": String(camera.captureRotationAngle)])
    return url.lastPathComponent
  }

  func stopSegment() async -> String {
    let outcome = await pipeline.closeSegment()
    log.info("writer", "Segment closed", ["outcome": String(describing: outcome)])
    return String(describing: outcome)
  }

  func stats() -> [String: String] {
    let stats = pipeline.statsSnapshot
    let now = HostClock.now()
    return [
      "camera": "\(stats.cameraWidth)x\(stats.cameraHeight) \(format(stats.cameraRate.rate(at: now))) fps, dropped \(stats.cameraDroppedFrames)",
      "file": "\(stats.writerState.rawValue) \(format(stats.fileRate.rate(at: now))) fps, \(format(stats.segmentSec)) s, dropped \(stats.fileDroppedFrames)",
      "audio": "\(format(stats.audioLevelDb)) dB, \(Int(stats.audioSampleRate)) Hz, buffers \(stats.audioBufferCount), max gap \(format(stats.audioMaxGapMs)) ms",
      "clock": "drift \(format(stats.audioDriftMs)) ms, resyncs \(stats.audioResyncCount)",
    ]
  }

  private func format(_ value: Double) -> String {
    String(format: "%.1f", value)
  }
}
