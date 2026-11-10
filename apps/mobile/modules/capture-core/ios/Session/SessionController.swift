import AVFoundation
import UIKit
import os

@MainActor
final class SessionController {
  private static let healthTick = Duration.milliseconds(250)
  private static let micPhases: Set<SessionPhase> = [.starting, .recording, .resuming]

  let log: EventLog
  private let camera = CameraSource()
  private let pipeline: MediaPipeline
  private let microphone: MicrophoneSource
  private let callPublisher: CallPublisher
  private let store: RecordingStore
  /// Read synchronously by `getSnapshot()` on the JS thread.
  nonisolated let snapshotCache = OSAllocatedUnfairLock(initialState: SessionSnapshot(state: SessionState(), recordedSec: 0))
  nonisolated let configCache = OSAllocatedUnfairLock(initialState: CaptureConfig.defaults)

  nonisolated var captureSession: AVCaptureSession { camera.session }
  var onSnapshot: ((SessionSnapshot) -> Void)?
  var onHealth: ((HealthSnapshot) -> Void)?
  var onRecoveryFound: (([RecoveryReport]) -> Void)?

  private let files: SessionFiles
  private let writerFailures: AsyncStream<Failure>
  private let routeMonitor: AudioRouteMonitor
  private lazy var systemEvents = SystemEventMonitor(log: log, camera: camera) { [weak self] event in
    self?.handleSystemEvent(event)
  }
  private var machine = SessionMachine()
  private var config = CaptureConfig.defaults
  private var manifest: SessionManifest?
  private var credentials: CallCredentials?
  private var thermalPolicy = ThermalPolicy(
    profiles: CaptureConfig.defaults.call.thermalProfiles,
    recoveryDelay: CaptureConfig.defaults.call.thermalRecoveryDelaySec
  )
  private var healthWatch = HealthWatch(health: CaptureConfig.defaults.health)
  private var fileRateWatch = FileRateWatch(targetFps: CaptureConfig.defaults.camera.fps)
  private var lastFileBytes: Int64 = 0
  private var diskFreeBytes: Int64 = 0
  private var fileSizeGate = IntervalGate(every: 1)
  private var diskGate = IntervalGate(every: 10, startingAt: -.infinity)
  private var heartbeatGate = IntervalGate(every: CaptureConfig.defaults.session.heartbeatIntervalSec)
  private var healthEmitGate = IntervalGate(every: 1)
  private var backgroundLogGate = IntervalGate(every: 5)
  private var needsCameraRebuild = false
  private var healthLoop: Task<Void, Never>?
  private var sequence: Task<Void, Never>?
  private let segmentWork = SerialTaskQueue()
  private let phaseWaiters = PhaseWaiters()
  private let library: RecordingLibrary
  private let backgroundTask: BackgroundTask
  private var lastSummary: RecordingSummary?

  nonisolated init() {
    let ioQueue = DispatchQueue(label: "capture-core.io", qos: .utility)
    let log = EventLog(subsystem: Bundle.main.bundleIdentifier ?? "CaptureCore", ioQueue: ioQueue)
    let (writerFailures, failureSink) = AsyncStream<Failure>.makeStream()
    let pipeline = MediaPipeline(log: log) { failureSink.yield($0) }
    self.log = log
    self.writerFailures = writerFailures
    self.pipeline = pipeline
    microphone = MicrophoneSource(pipeline: pipeline, log: log)
    callPublisher = CallPublisher(log: log)
    store = .documents
    files = SessionFiles(store: store, log: log, queue: ioQueue)
    library = RecordingLibrary(store: store, files: files, log: log)
    backgroundTask = BackgroundTask(log: log)
    routeMonitor = AudioRouteMonitor(log: log)
  }

  func activate() async {
    guard healthLoop == nil else {
      emitSnapshot()
      if !recoveryReports.isEmpty { onRecoveryFound?(recoveryReports) }
      return
    }
    log.info("camera", "Capture session created")
    pipeline.setCallSink(callPublisher.scaler)
    callPublisher.onStatusChange = { [weak self] status in self?.send(.callChanged(status)) }
    systemEvents.start()
    routeMonitor.start()
    healthLoop = Task { [weak self] in
      while !Task.isCancelled {
        try? await Task.sleep(for: Self.healthTick)
        guard let self else { return }
        self.healthTick()
      }
    }
    Task { [weak self, writerFailures] in
      for await failure in writerFailures {
        self?.send(.failure(failure, pauseReason: .fileError))
      }
    }
    emitSnapshot()
    await recoverUnfinishedSessions()
  }

  func prepare(overrides: [String: Any]) async throws -> CaptureConfig {
    guard machine.state.phase == .idle || machine.state.phase == .ready else { throw invalidState("prepare") }
    let resolved: CaptureConfig
    do {
      resolved = try ConfigResolver.resolve(overrides: overrides)
    } catch let error as ConfigError {
      throw Failure(code: .configInvalid, message: error.message)
    }
    guard Permissions.current().allGranted else {
      throw Failure(code: .permissionDenied, message: "Camera and microphone access are required")
    }
    adopt(resolved)
    send(.prepareRequested(resolved.session.resumePolicy, callProfile: thermalPolicy.current))
    let state = await waitForPhase(in: [.ready, .idle])
    if state.phase == .idle, let error = state.error {
      throw Failure(error)
    }
    return resolved
  }

  func start(_ credentials: CallCredentials) async throws -> String {
    guard machine.state.phase == .ready else { throw invalidState("start") }
    self.credentials = credentials
    let sessionId = SessionId.make(at: Date())
    send(.startRequested(sessionId: sessionId))
    let state = await waitForPhase(in: [.recording, .pausing, .paused, .ready, .idle])
    guard state.phase != .ready, state.phase != .idle else {
      throw state.error.map(Failure.init) ?? Failure(code: .startInterrupted, message: "Start did not complete")
    }
    return sessionId
  }

  func pause() async throws {
    guard machine.state.phase == .recording else { throw invalidState("pause") }
    send(.pauseRequested)
    _ = await waitForPhase(in: [.paused, .ready, .idle])
  }

  func resume() async throws {
    guard machine.state.phase == .paused else { throw invalidState("resume") }
    send(.resumeRequested)
    let state = await waitForPhase(in: [.recording, .paused, .ready, .idle])
    guard state.phase == .recording else {
      throw state.error.map(Failure.init) ?? invalidState("resume")
    }
  }

  func stop() async throws -> RecordingSummary {
    guard [.recording, .pausing, .paused, .resuming].contains(machine.state.phase) else { throw invalidState("stop") }
    lastSummary = nil
    send(.stopRequested)
    _ = await waitForPhase(in: [.ready, .idle])
    guard let lastSummary else { throw invalidState("stop") }
    return lastSummary
  }

  func reconnectCall() async throws {
    guard machine.state.hasSession else { throw invalidState("reconnect the call") }
    let publish = RejoinPlan.publishesTracks(in: machine.state.phase)
    try await callPublisher.ensureJoined(rotationAngle: camera.captureRotationAngle, publish: publish)
    if machine.state.phase != .recording { await callPublisher.setMuted(true, reason: machine.state.pauseReason) }
  }

  func dismissError() {
    send(.errorDismissed)
  }

  var recoveryReports: [RecoveryReport] { library.recoveryReports }

  func listRecordings() async -> [RecordingSummary] {
    await library.list()
  }

  func acknowledgeRecovery(sessionId: String) throws {
    try library.acknowledgeRecovery(sessionId: sessionId)
  }

  func verifyRecording(sessionId: String) async throws -> VerificationReport {
    try await library.verify(sessionId: sessionId)
  }

  func deleteRecording(sessionId: String) throws {
    guard sessionId != manifest?.id else { throw invalidState("delete the active recording") }
    try library.delete(sessionId: sessionId)
  }

  private func recoverUnfinishedSessions() async {
    let reports = await library.recoverUnfinished()
    if !reports.isEmpty { onRecoveryFound?(reports) }
  }

  private func send(_ event: SessionEvent) {
    let before = machine.state
    let effects = machine.handle(event, at: Date())
    guard !effects.isEmpty || machine.state != before else {
      log.log(.debug, "machine", "Ignored event", ["event": "\(event)", "phase": before.phase.rawValue])
      return
    }
    if machine.state.phase != before.phase {
      log.info("machine", "\(before.phase.rawValue) → \(machine.state.phase.rawValue)", [
        "event": "\(event)",
        "pauseReason": machine.state.pauseReason?.rawValue ?? "",
      ])
    }
    effects.forEach(perform)
    emitSnapshot()
    phaseWaiters.resume(with: machine.state)
  }

  private func perform(_ effect: SessionEffect) {
    switch effect {
    case .startCamera:
      Task {
        do {
          try await startCamera()
          send(.cameraStarted)
        } catch {
          send(.cameraFailed(Failure(error, fallback: .cameraUnavailable)))
        }
      }
    case .runStartSequence(let sessionId):
      sequence = Task {
        do {
          try await runStart(sessionId: sessionId)
          send(.startSucceeded(sessionId: sessionId))
        } catch is CancellationError {
          return
        } catch {
          send(.startFailed(sessionId: sessionId, Failure(error, fallback: .callConnectFailed)))
        }
      }
    case .abortStart(let sessionId):
      sequence?.cancel()
      sequence = nil
      abortStart(sessionId: sessionId)
    case .openSegment(let index):
      segmentWork.enqueue { await self.openSegment(index: index) }
    case .closeSegment(let index):
      healthWatch.stopWatching()
      segmentWork.enqueue { await self.closeSegment(index: index) }
    case .muteCall(let muted):
      let reason = machine.state.pauseReason
      Task { await callPublisher.setMuted(muted, reason: reason) }
    case .stopMic:
      // Behind the queued segment close, so the file's audio still covers its last video frames.
      segmentWork.enqueue {
        // A resume that arrived meanwhile needs the mic again.
        guard !Self.micPhases.contains(self.machine.state.phase) else { return }
        self.microphone.stop()
      }
    case .runResumeSequence:
      sequence = Task {
        do {
          try await runResume()
          send(.resumeSucceeded)
        } catch is CancellationError {
          return
        } catch {
          microphone.stop()
          send(.resumeFailed(Failure(error, fallback: .cameraUnavailable)))
        }
      }
    case .cancelResumeSequence:
      sequence?.cancel()
      sequence = nil
      microphone.stop()
      let reason = machine.state.pauseReason
      Task { await callPublisher.setMuted(true, reason: reason) }
    case .runStopSequence:
      sequence = Task { await runStop() }
    case .finishSession:
      finishSession()
    case .beginBackgroundTask:
      backgroundTask.begin()
    case .endBackgroundTask:
      backgroundTask.end()
    case .setIdleTimerDisabled(let disabled):
      UIApplication.shared.isIdleTimerDisabled = disabled
    case .saveManifest:
      saveManifest()
    case .applyCallProfile(let name):
      callPublisher.apply(config.call.profiles[name])
    }
  }

  private func handleSystemEvent(_ event: SystemEventMonitor.Event) {
    switch event {
    case .session(let sessionEvent):
      send(sessionEvent)
    case .thermalChanged:
      updateThermal()
    case .mediaServicesReset:
      needsCameraRebuild = true
      send(.failure(Failure(code: .mediaServicesReset, message: "iOS reset its media services"), pauseReason: .mediaServicesReset))
    }
  }

  private func startCamera() async throws {
    let startedAt = HostClock.now()
    let report = try await camera.configure(config.camera, frames: pipeline, on: pipeline.queue)
    pipeline.setCaptureClock(camera.synchronizationClock)
    systemEvents.observeSystemPressure(of: camera.device)
    await camera.start()
    log.info("camera", "Camera configured", report.logData)
    guard try await pipeline.heartbeats.waitForBeat(.camera, after: startedAt, timeout: config.session.resumeTimeoutSec) else {
      throw Failure(code: .cameraStalled, message: "No camera frames within \(Int(config.session.resumeTimeoutMs)) ms")
    }
    needsCameraRebuild = false
  }

  private func startMicrophone() async throws {
    let startedAt = HostClock.now()
    try microphone.start(config.audio)
    guard try await pipeline.heartbeats.waitForBeat(.microphone, after: startedAt, timeout: config.session.resumeTimeoutSec) else {
      microphone.stop()
      throw Failure(code: .micUnavailable, message: "No microphone audio within \(Int(config.session.resumeTimeoutMs)) ms. Is a phone call active?")
    }
  }

  private func runStart(sessionId: String) async throws {
    try requireFreeSpace()
    guard let credentials else { throw Failure(code: .callConnectFailed, message: "No call credentials") }
    try Task.checkCancellation()
    let created = SessionManifest(id: sessionId, createdAt: Date(), state: .recording, config: config, device: .current)
    do {
      try store.create(created)
    } catch {
      throw Failure(code: .fileWriterFailed, message: "Cannot create the session folder: \(error.localizedDescription)")
    }
    manifest = created
    log.attachFile(at: store.eventsURL(sessionId: sessionId))
    log.info("session", "Session created", ["sessionId": sessionId])
    try await startMicrophone()
    try Task.checkCancellation()
    try await callPublisher.join(credentials, profile: config.call.profiles[thermalPolicy.current], rotationAngle: camera.captureRotationAngle)
    try Task.checkCancellation()
    manifest?.room = callPublisher.status.room
  }

  /// Runs at once, so a Start pressed right after cannot lose its microphone or its session folder.
  private func abortStart(sessionId: String) {
    // Before leaving, as in Stop: the room stops the audio engine, and a mic still marked as needed would restart it.
    microphone.stop()
    if manifest?.id == sessionId {
      manifest = nil
      log.attachFile(at: nil)
      files.delete(sessionId: sessionId)
    }
    Task { await callPublisher.leave() }
  }


  /// Local resources first: they recover fast and decide whether rejoining the call makes sense.
  private func runResume() async throws {
    try await ensureCamera()
    try Task.checkCancellation()
    try await startMicrophone()
    try Task.checkCancellation()
    try await callPublisher.ensureJoined(rotationAngle: camera.captureRotationAngle, publish: true)
    try Task.checkCancellation()
    await callPublisher.setMuted(false, reason: nil)
  }

  private func ensureCamera() async throws {
    if needsCameraRebuild {
      try await startCamera()
      return
    }
    let since = HostClock.now()
    if !camera.isRunning { await camera.start() }
    if try await pipeline.heartbeats.waitForBeat(.camera, after: since, timeout: config.session.resumeTimeoutSec) { return }
    log.warning("camera", "No frames after resume; rebuilding the capture session")
    try await startCamera()
  }

  private func runStop() async {
    backgroundTask.begin()
    healthWatch.stopWatching()
    await segmentWork.enqueue { await self.closeSegment(index: self.machine.state.segmentIndex) }.value
    // Before leaving: the room stops the audio engine, and a mic still marked as needed would restart it.
    microphone.stop()
    await callPublisher.leave()
    backgroundTask.end()
    send(.stopFinished)
  }

  private func openSegment(index: Int) async {
    guard let sessionId = manifest?.id else { return }
    let url = store.segmentURL(sessionId: sessionId, index: index)
    do {
      try await pipeline.openSegment(pipeline.segmentSettings(url: url, config: config, rotationAngle: camera.captureRotationAngle))
    } catch {
      send(.failure(Failure(error, fallback: .fileWriterFailed), pauseReason: .fileError))
      return
    }
    manifest?.openSegment(index: index, at: Date())
    saveManifest()
    lastFileBytes = 0
    fileRateWatch = FileRateWatch(targetFps: config.camera.fps)
    healthWatch.watchSegment(openedAt: HostClock.now())
    log.info("writer", "Segment \(index) opened", [
      "file": url.lastPathComponent,
      "rotation": String(camera.captureRotationAngle),
      "callProfile": thermalPolicy.current.rawValue,
    ])
  }

  private func closeSegment(index: Int) async {
    let pauseReason = machine.state.pauseReason
    guard let outcome = await pipeline.closeSegment() else {
      send(.segmentClosed(index: index, failure: nil))
      return
    }
    var failure: Failure?
    if case .failed(let message) = outcome {
      failure = Failure(code: .fileWriterFailed, message: message)
    }
    manifest?.closeSegment(index: index, outcome: outcome, pauseReason: pauseReason, at: Date())
    if failure != nil, let sessionId = manifest?.id {
      let inspection = await RecoveryInspector.inspect(store.segmentURL(sessionId: sessionId, index: index))
      manifest?.applyInspection(inspection, toSegment: index)
    }
    saveManifest()
    log.info("writer", "Segment \(index) closed", ["outcome": "\(outcome)"])
    send(.segmentClosed(index: index, failure: failure))
  }

  private func finishSession() {
    guard var finished = manifest else { return }
    finished.finish()
    manifest = nil
    files.save(finished)
    let directory = store.directory(for: finished.id)
    lastSummary = RecordingSummary(finished, directory: directory)
    log.info("session", "Session finished", ["segments": String(finished.segments.count), "recordedSec": finished.recordedSec.oneDecimal])
    log.attachFile(at: nil)
    Task {
      let report = await RecordingVerifier.verify(finished, directory: directory)
      files.save(report)
      let data = ["sessionId": finished.id, "failed": report.failedCheckIds.joined(separator: ",")]
      let message = report.pass ? "Recording passed verification" : "Recording failed verification"
      log.log(report.pass ? .info : .warning, "verify", message, data, file: store.eventsURL(sessionId: finished.id))
    }
  }

  private func healthTick() {
    let now = HostClock.now()
    let stats = pipeline.statsSnapshot
    let micRestart = [microphone.lastEngineStopAt, routeMonitor.lastInputChangeAt].compactMap { $0 }.max()
    let restartedAt = micRestart.map { [HeartbeatSource.microphone: $0] } ?? [:]
    for edge in healthWatch.edges(now: now, phase: machine.state.phase, lastBeats: pipeline.heartbeats.snapshot(), restartedAt: restartedAt) {
      react(to: edge)
    }
    if machine.state.phase == .recording {
      checkFileGrowth(now: now)
      if let reaction = fileRateWatch.update(fps: stats.fileRate.rate(at: now), segmentSec: stats.segmentSec, at: now) {
        apply(reaction)
      }
      writeHeartbeat(stats, now: now)
    }
    updateThermal()
    if diskGate.opens(at: now) { checkDisk() }
    if !machine.state.appActive, backgroundLogGate.opens(at: now) {
      log.info("system", "App alive in background", [
        "micRunning": String(microphone.isRunning),
        "call": machine.state.call.state.rawValue,
      ])
    }
    if healthEmitGate.opens(at: now) {
      onHealth?(healthSnapshot(stats, now: now))
      if machine.state.phase == .recording { emitSnapshot() }
    }
  }

  private func react(to edge: HealthEdge) {
    let thresholdMs = healthWatch.thresholdMs(for: edge.source)
    log.log(edge.stalled ? .warning : .info, "health", "\(edge.source.rawValue) \(edge.stalled ? "stalled" : "recovered")", ["thresholdMs": String(thresholdMs)])
    if let reaction = edge.reaction(thresholdMs: thresholdMs) { apply(reaction) }
  }

  private func apply(_ reaction: HealthReaction) {
    switch reaction {
    case .pause(let failure, let reason): send(.failure(failure, pauseReason: reason))
    case .warn(let code, let message): raiseWarning(code, message)
    case .clearWarning(let code): clearWarning(code)
    }
  }

  private func checkFileGrowth(now: Double) {
    guard let sessionId = manifest?.id, fileSizeGate.opens(at: now) else { return }
    // A fresh URL each time: URL caches resource values per instance.
    let url = store.segmentURL(sessionId: sessionId, index: machine.state.segmentIndex)
    let bytes = url.fileSize
    if bytes > lastFileBytes { pipeline.heartbeats.beat(.fileBytes, at: now) }
    lastFileBytes = bytes
  }

  private func writeHeartbeat(_ stats: MediaStats, now: Double) {
    guard heartbeatGate.opens(at: now) else { return }
    manifest?.recordHeartbeat(lastVideoSec: stats.segmentSec, at: Date())
    saveManifest()
  }

  private func updateThermal() {
    let level = ThermalLevel(ProcessInfo.processInfo.thermalState)
    let profile = thermalPolicy.update(level: level, now: HostClock.now())
    guard profile != nil || level != machine.state.thermal else { return }
    log.log(profile == nil ? .info : .warning, "system", "Thermal level \(level.rawValue)", ["callProfile": thermalPolicy.current.rawValue])
    send(.thermalChanged(level, profile: profile))
  }

  private func checkDisk() {
    guard let free = DiskSpace.availableBytes() else {
      log.warning("system", "iOS did not report free disk space")
      return
    }
    diskFreeBytes = free
    apply(DiskSpacePolicy(config).reaction(freeBytes: free, isRecording: machine.state.phase == .recording))
  }

  private func requireFreeSpace() throws {
    guard let free = DiskSpace.availableBytes() else {
      log.warning("system", "iOS did not report free disk space; starting anyway")
      return
    }
    if let failure = DiskSpacePolicy(config).failureToStart(freeBytes: free) { throw failure }
  }

  private func healthSnapshot(_ stats: MediaStats, now: Double) -> HealthSnapshot {
    HealthSnapshot(
      at: Date(),
      camera: .init(stats, now: now),
      file: .init(stats, now: now, bytes: lastFileBytes),
      audio: .init(stats, now: now),
      call: callPublisher.outboundVideoStats(),
      thermal: machine.state.thermal,
      systemPressure: systemEvents.systemPressure,
      audioRoute: routeMonitor.current,
      diskFreeBytes: diskFreeBytes
    )
  }

  private func adopt(_ resolved: CaptureConfig) {
    config = resolved
    configCache.withLock { $0 = resolved }
    thermalPolicy = ThermalPolicy(profiles: resolved.call.thermalProfiles, recoveryDelay: resolved.call.thermalRecoveryDelaySec)
    healthWatch = HealthWatch(health: resolved.health)
    heartbeatGate = IntervalGate(every: resolved.session.heartbeatIntervalSec)
    callPublisher.configure(call: resolved.call, audio: resolved.audio)
  }

  private func raiseWarning(_ code: CaptureErrorCode, _ message: String) {
    guard machine.state.warnings[code] == nil else { return }
    send(.warningRaised(code: code, message: message))
  }

  private func clearWarning(_ code: CaptureErrorCode) {
    guard machine.state.warnings[code] != nil else { return }
    send(.warningCleared(code))
  }

  private func emitSnapshot() {
    let recordedSec = SessionSnapshot.recordedSec(
      manifestSec: manifest?.recordedSec ?? 0, phase: machine.state.phase, openSegmentSec: pipeline.statsSnapshot.segmentSec)
    let snapshot = SessionSnapshot(state: machine.state, recordedSec: recordedSec)
    snapshotCache.withLock { $0 = snapshot }
    onSnapshot?(snapshot)
  }

  private func waitForPhase(in phases: Set<SessionPhase>) async -> SessionState {
    await phaseWaiters.wait(for: phases, current: machine.state)
  }

  private func invalidState(_ command: String) -> Failure {
    Failure(code: .invalidState, message: "Can't \(command) while \(machine.state.phase.rawValue)")
  }

  private func saveManifest() {
    if let manifest { files.save(manifest) }
  }
}
