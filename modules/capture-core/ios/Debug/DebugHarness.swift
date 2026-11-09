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
  lazy var microphone = MicrophoneSource(pipeline: pipeline, log: log)
  lazy var routes = AudioRouteMonitor(log: log)

  nonisolated init() {
    let log = EventLog(subsystem: Bundle.main.bundleIdentifier ?? "CaptureCore", ioQueue: DispatchQueue(label: "capture-core.io"))
    self.log = log
    pipeline = MediaPipeline(log: log) { failure in
      log.error("debug", "Writer failure reported", ["message": failure.message])
    }
    store = RecordingStore(root: URL.documentsDirectory.appending(path: "Recordings", directoryHint: .isDirectory))
  }

  private lazy var system = SystemEventMonitor(log: log, camera: camera) { [log] event in
    log.info("debug", "System event", ["event": String(describing: event)])
  }

  func startCamera() async throws -> [String: String] {
    let startedAt = HostClock.now()
    let report = try await camera.configure(config.camera, frames: pipeline, on: pipeline.queue)
    pipeline.setCaptureClock(camera.synchronizationClock)
    await camera.start()
    let delivering = await pipeline.heartbeats.waitForBeat(.camera, after: startedAt, timeout: config.session.resumeTimeoutMs / 1000)
    system.start()
    system.observeSystemPressure(of: camera.device)
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

  func startMic() async throws -> [String: String] {
    routes.start()
    let startedAt = HostClock.now()
    try microphone.start(config.audio)
    guard await pipeline.heartbeats.waitForBeat(.microphone, after: startedAt, timeout: config.session.resumeTimeoutMs / 1000) else {
      throw Failure(code: .micUnavailable, message: "No microphone buffers within \(Int(config.session.resumeTimeoutMs)) ms")
    }
    return microphone.processingReport()
  }

  func stopMic() {
    microphone.stop()
  }

  lazy var call: CallPublisher = {
    let call = CallPublisher(log: log)
    pipeline.setCallSink(call.scaler)
    return call
  }()

  func connect(url: String, token: String) async throws -> [String] {
    try await call.join(CallCredentials(url: url, token: token), profile: config.call.profiles.standard, rotationAngle: camera.captureRotationAngle)
    return call.status.remoteParticipants
  }

  func disconnect() async {
    await call.leave()
  }

  func setCallProfile(_ name: CallProfileName) {
    call.apply(config.call.profiles[name])
  }

  func stopSegment() async -> String {
    let outcome = await pipeline.closeSegment()
    log.info("writer", "Segment closed", ["outcome": String(describing: outcome)])
    return String(describing: outcome)
  }

  func inspectLatestSegment() async throws -> [String: String] {
    guard let url = latestSegmentURL() else {
      throw Failure(code: .recoveryUnplayable, message: "No segments on disk")
    }
    let inspection = await RecoveryInspector.inspect(url)
    let result = [
      "file": "\(url.deletingLastPathComponent().lastPathComponent)/\(url.lastPathComponent)",
      "uri": url.absoluteString,
      "playable": String(inspection.playable),
      "durationSec": format(inspection.durationSec),
      "bytes": String(inspection.bytes),
      "reason": inspection.failureReason ?? "",
    ]
    log.info("recovery", "Segment inspected", result)
    return result
  }

  private func latestSegmentURL() -> URL? {
    let fileManager = FileManager.default
    let sessions = (try? fileManager.contentsOfDirectory(at: store.root, includingPropertiesForKeys: nil)) ?? []
    guard let latestSession = sessions.max(by: { $0.lastPathComponent < $1.lastPathComponent }) else { return nil }
    let files = (try? fileManager.contentsOfDirectory(at: latestSession, includingPropertiesForKeys: nil)) ?? []
    return files.filter { $0.pathExtension == "mov" }.max { $0.lastPathComponent < $1.lastPathComponent }
  }

  func stats() -> [String: String] {
    let stats = pipeline.statsSnapshot
    let now = HostClock.now()
    return [
      "camera": "\(stats.cameraWidth)x\(stats.cameraHeight) \(format(stats.cameraRate.rate(at: now))) fps, dropped \(stats.cameraDroppedFrames)",
      "file": "\(stats.writerState.rawValue) \(format(stats.fileRate.rate(at: now))) fps, \(format(stats.segmentSec)) s, dropped \(stats.fileDroppedFrames)",
      "audio": "\(format(stats.audioLevelDb)) dB, \(Int(stats.audioSampleRate)) Hz, buffers \(stats.audioBufferCount), max gap \(format(stats.audioMaxGapMs)) ms",
      "clock": "drift \(format(stats.audioDriftMs)) ms, resyncs \(stats.audioResyncCount)",
      "call": {
        let sent = call.sendStats()
        return "\(sent.sentWidth)x\(sent.sentHeight) \(format(sent.sentFps)) fps, \(Int(sent.bitrateKbps)) kbps, limit \(sent.qualityLimitation.rawValue), dropped \(sent.droppedFrames)"
      }(),
      "thermal": "\(ProcessInfo.processInfo.thermalState.rawValue)",
      "engine": AudioManager.shared.isEngineRunning ? "running" : "stopped",
      "route": "in \(routes.current.input), out \(routes.current.output)",
    ]
  }

  private func format(_ value: Double) -> String {
    String(format: "%.1f", value)
  }
}
