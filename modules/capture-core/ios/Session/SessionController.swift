import AVFoundation
import UIKit
import os

@MainActor
final class SessionController {
  private static let healthTick = Duration.milliseconds(250)
  private static let healthEmitInterval = 1.0
  private static let fileSizeCheckInterval = 1.0
  private static let diskCheckInterval = 10.0
  private static let backgroundLogInterval = 5.0
  private static let fileFpsLowDuration = 3.0
  private static let fileFpsTolerance = 0.5
  private static let bytesPerMegabyte: Int64 = 1_048_576
  private static let micPhases: Set<SessionPhase> = [.starting, .recording, .resuming]

  let log: EventLog
  let camera = CameraSource()
  let pipeline: MediaPipeline
  let microphone: MicrophoneSource
  let call: CallPublisher
  let store: RecordingStore
  nonisolated let snapshotCache = OSAllocatedUnfairLock(initialState: SessionSnapshot(state: SessionState(), recordedSec: 0))
  nonisolated let configCache = OSAllocatedUnfairLock(initialState: CaptureConfig.defaults)

  var onSnapshot: ((SessionSnapshot) -> Void)?
  var onHealth: ((HealthSnapshot) -> Void)?
  var onRecoveryFound: (([RecoveryReport]) -> Void)?

  private let ioQueue: DispatchQueue
  private let writerFailures: AsyncStream<Failure>
  private let routeMonitor: AudioRouteMonitor
  private lazy var monitor = SystemEventMonitor(log: log, camera: camera) { [weak self] event in
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
  private var healthMonitor = HealthMonitor(health: CaptureConfig.defaults.health)
  private var watched: [Pipeline: Double] = [:]
  private var fileFpsLow = SustainedCondition(duration: fileFpsLowDuration)
  private var lastFileBytes: Int64 = 0
  private var diskFreeBytes: Int64 = 0
  private var lastSizeCheck = 0.0
  private var lastDiskCheck = -Double.infinity
  private var lastHeartbeat = 0.0
  private var lastHealthEmit = 0.0
  private var lastBackgroundLog = 0.0
  private var needsCameraRebuild = false
  private var healthLoop: Task<Void, Never>?
  private var sequence: Task<Void, Never>?
  private var segmentWork: Task<Void, Never>?
  private var phaseWaiters: [(phases: Set<SessionPhase>, continuation: CheckedContinuation<SessionState, Never>)] = []
  private var backgroundTask = UIBackgroundTaskIdentifier.invalid
  private var lastSummary: RecordingSummary?
  private(set) var recoveryReports: [RecoveryReport] = []

  nonisolated init() {
    let ioQueue = DispatchQueue(label: "capture-core.io", qos: .utility)
    let log = EventLog(subsystem: Bundle.main.bundleIdentifier ?? "CaptureCore", ioQueue: ioQueue)
    let (writerFailures, failureSink) = AsyncStream<Failure>.makeStream()
    let pipeline = MediaPipeline(log: log) { failureSink.yield($0) }
    self.ioQueue = ioQueue
    self.log = log
    self.writerFailures = writerFailures
    self.pipeline = pipeline
    microphone = MicrophoneSource(pipeline: pipeline, log: log)
    call = CallPublisher(log: log)
    store = RecordingStore(root: URL.documentsDirectory.appending(path: "Recordings", directoryHint: .isDirectory))
    routeMonitor = AudioRouteMonitor(log: log)
  }

  func activate() {
    log.info("camera", "Capture session created")
    pipeline.setCallSink(call.scaler)
    call.onStatusChange = { [weak self] status in self?.send(.callChanged(status)) }
    monitor.start()
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
    apply(resolved)
    send(.prepareRequested(resolved.session.resumePolicy))
    let state = await waitForPhase(in: [.ready, .idle])
    if state.phase == .idle, let error = state.error {
      throw Failure(code: error.code, message: error.message)
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
      throw state.error.map { Failure(code: $0.code, message: $0.message) } ?? Failure(code: .startInterrupted, message: "Start did not complete")
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
      throw state.error.map { Failure(code: $0.code, message: $0.message) } ?? invalidState("resume")
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
    try await call.ensureJoined(rotationAngle: camera.captureRotationAngle)
    if machine.state.phase != .recording { await call.setMuted(true) }
  }

  func dismissError() {
    send(.errorDismissed)
  }

  func listRecordings() async -> [RecordingSummary] {
    let store = store
    let scan = await Task.detached { store.scan() }.value
    return scan.manifests.map { RecordingSummary($0, directory: store.directory(for: $0.id)) }
  }

  func acknowledgeRecovery(sessionId: String) throws {
    var recovered = try store.load(sessionId)
    recovered.acknowledgedAt = Date()
    try store.save(recovered)
    recoveryReports.removeAll { $0.sessionId == sessionId }
  }

  func verifyRecording(sessionId: String) async throws -> VerificationReport {
    let manifest = try store.load(sessionId)
    let report = await RecordingVerifier.verify(manifest, directory: store.directory(for: sessionId))
    saveVerification(report)
    return report
  }

  func deleteRecording(sessionId: String) throws {
    guard sessionId != manifest?.id else { throw invalidState("delete the active recording") }
    try store.delete(sessionId)
    recoveryReports.removeAll { $0.sessionId == sessionId }
  }

  func recoverUnfinishedSessions() async {
    let store = store
    let scan = await Task.detached { store.scan() }.value
    for name in scan.unreadable {
      log.error("recovery", "Unreadable session manifest", ["session": name])
    }
    for unfinished in scan.manifests where unfinished.isUnfinished {
      var inspections: [Int: SegmentInspection] = [:]
      for segment in unfinished.segments where segment.state == .writing {
        inspections[segment.index] = await RecoveryInspector.inspect(store.segmentURL(sessionId: unfinished.id, index: segment.index))
      }
      let (recovered, report) = Recovery.recover(unfinished, inspections: inspections, directory: store.directory(for: unfinished.id))
      save(recovered)
      recoveryReports.append(report)
      log.warning("recovery", "Unfinished recording found", [
        "sessionId": report.sessionId,
        "recoveredSec": format(report.recoveredSec),
        "knownLossSec": format(report.knownLossSec),
        "maxUnseenLossSec": format(report.maxUnseenLossSec),
        "unplayable": String(report.segments.filter { $0.state == .unplayable }.count),
      ])
    }
    if !recoveryReports.isEmpty { onRecoveryFound?(recoveryReports) }
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
    resumeWaiters()
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
          send(.startSucceeded)
        } catch is CancellationError {
          await abortStart()
        } catch {
          send(.startFailed(Failure(error, fallback: .callConnectFailed)))
        }
      }
    case .abortStart:
      sequence?.cancel()
      sequence = nil
      Task { await abortStart() }
    case .openSegment(let index):
      enqueueSegmentWork { await self.openSegment(index: index) }
    case .closeSegment(let index):
      watched = [:]
      enqueueSegmentWork { await self.finishSegment(index: index) }
    case .muteCall(let muted):
      Task { await call.setMuted(muted) }
    case .stopMic:
      enqueueSegmentWork {
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
      Task { await call.setMuted(true) }
    case .runStopSequence:
      sequence = Task { await runStop() }
    case .finishSession:
      finishSession()
    case .beginBackgroundTask:
      beginBackgroundTask()
    case .endBackgroundTask:
      endBackgroundTask()
    case .setIdleTimerDisabled(let disabled):
      UIApplication.shared.isIdleTimerDisabled = disabled
    case .persistManifest:
      persistManifest()
    case .applyCallProfile(let name):
      call.apply(config.call.profiles[name])
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

  private var resumeTimeout: Double { config.session.resumeTimeoutMs / 1000 }

  private func startCamera() async throws {
    let startedAt = HostClock.now()
    let report = try await camera.configure(config.camera, frames: pipeline, on: pipeline.queue)
    pipeline.setCaptureClock(camera.synchronizationClock)
    monitor.observeSystemPressure(of: camera.device)
    await camera.start()
    log.info("camera", "Camera configured", report.logData)
    guard await pipeline.heartbeats.waitForBeat(.camera, after: startedAt, timeout: resumeTimeout) else {
      throw Failure(code: .cameraStalled, message: "No camera frames within \(Int(config.session.resumeTimeoutMs)) ms")
    }
    needsCameraRebuild = false
  }

  private func startMicrophone() async throws {
    let startedAt = HostClock.now()
    try microphone.start(config.audio)
    guard await pipeline.heartbeats.waitForBeat(.microphone, after: startedAt, timeout: resumeTimeout) else {
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
    try await call.join(credentials, profile: config.call.profiles[thermalPolicy.current], rotationAngle: camera.captureRotationAngle)
    try Task.checkCancellation()
    manifest?.room = call.status.room
  }

  private func abortStart() async {
    await call.leave()
    microphone.stop()
    guard let abandoned = manifest else { return }
    manifest = nil
    log.attachFile(at: nil)
    let store = store
    let log = log
    ioQueue.async {
      do {
        try store.delete(abandoned.id)
      } catch {
        log.warning("session", "Could not delete the abandoned session folder", ["error": error.localizedDescription])
      }
    }
  }

  private func runResume() async throws {
    try await ensureCamera()
    try Task.checkCancellation()
    try await startMicrophone()
    try Task.checkCancellation()
    try await call.ensureJoined(rotationAngle: camera.captureRotationAngle)
    try Task.checkCancellation()
    await call.setMuted(false)
  }

  private func ensureCamera() async throws {
    if needsCameraRebuild {
      try await startCamera()
      return
    }
    let since = HostClock.now()
    if !camera.isRunning { await camera.start() }
    if await pipeline.heartbeats.waitForBeat(.camera, after: since, timeout: resumeTimeout) { return }
    log.warning("camera", "No frames after resume; rebuilding the capture session")
    try await startCamera()
  }

  private func runStop() async {
    beginBackgroundTask()
    watched = [:]
    await enqueueSegmentWork { await self.finishSegment(index: self.machine.state.segmentIndex) }.value
    microphone.stop()
    await call.leave()
    endBackgroundTask()
    send(.stopFinished)
  }

  @discardableResult
  private func enqueueSegmentWork(_ work: @escaping @MainActor () async -> Void) -> Task<Void, Never> {
    let previous = segmentWork
    let next = Task {
      await previous?.value
      await work()
    }
    segmentWork = next
    return next
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
    persistManifest()
    lastFileBytes = 0
    fileFpsLow = SustainedCondition(duration: Self.fileFpsLowDuration)
    let now = HostClock.now()
    watched = Dictionary(uniqueKeysWithValues: Pipeline.allCases.map { ($0, now) })
    log.info("writer", "Segment \(index) opened", [
      "file": url.lastPathComponent,
      "rotation": String(camera.captureRotationAngle),
      "callProfile": thermalPolicy.current.rawValue,
    ])
  }

  private func finishSegment(index: Int) async {
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
    persistManifest()
    log.info("writer", "Segment \(index) closed", ["outcome": "\(outcome)"])
    send(.segmentClosed(index: index, failure: failure))
  }

  private func finishSession() {
    guard var finished = manifest else { return }
    finished.finish()
    manifest = nil
    save(finished)
    let directory = store.directory(for: finished.id)
    lastSummary = RecordingSummary(finished, directory: directory)
    log.info("session", "Session finished", ["segments": String(finished.segments.count), "recordedSec": format(finished.recordedSec)])
    Task {
      let report = await RecordingVerifier.verify(finished, directory: directory)
      saveVerification(report)
      log.log(report.pass ? .info : .warning, "verify", report.pass ? "Recording passed verification" : "Recording failed verification", [
        "sessionId": finished.id,
        "failed": report.segments.flatMap { segment in segment.checks.filter { !$0.pass }.map { "\(segment.index):\($0.id)" } }.joined(separator: ","),
      ])
      if manifest == nil { log.attachFile(at: nil) }
    }
  }

  private func healthTick() {
    let now = HostClock.now()
    let stats = pipeline.statsSnapshot
    let restartedAt = microphone.lastEngineStopAt.map { [Pipeline.microphone: $0] } ?? [:]
    for edge in healthMonitor.evaluate(now: now, lastBeats: pipeline.heartbeats.snapshot(), watched: watched, restartedAt: restartedAt) {
      handle(edge)
    }
    if machine.state.phase == .recording {
      checkFileGrowth(now: now)
      checkFileRate(stats, now: now)
      writeHeartbeat(stats, now: now)
    }
    updateThermal()
    if now - lastDiskCheck >= Self.diskCheckInterval { checkDisk(now: now) }
    if !machine.state.appActive, now - lastBackgroundLog >= Self.backgroundLogInterval {
      lastBackgroundLog = now
      log.info("system", "App alive in background", [
        "micRunning": String(microphone.isRunning),
        "call": machine.state.call.state.rawValue,
      ])
    }
    if now - lastHealthEmit >= Self.healthEmitInterval {
      lastHealthEmit = now
      onHealth?(healthSnapshot(stats, now: now))
      if machine.state.phase == .recording { emitSnapshot() }
    }
  }

  private func handle(_ edge: HealthEdge) {
    let thresholdMs = Int(healthMonitor.threshold(for: edge.pipeline) * 1000)
    log.log(edge.stalled ? .warning : .info, "health", "\(edge.pipeline.rawValue) \(edge.stalled ? "stalled" : "recovered")", ["thresholdMs": String(thresholdMs)])
    guard edge.stalled else {
      if edge.pipeline == .fileAudio { clearWarning(.audioStalled) }
      return
    }
    switch edge.pipeline {
    case .camera:
      send(.failure(Failure(code: .cameraStalled, message: "No camera frames for \(thresholdMs) ms"), pauseReason: .cameraStalled))
    case .microphone:
      send(.failure(Failure(code: .audioStalled, message: "No microphone audio for \(thresholdMs) ms"), pauseReason: .micStalled))
    case .fileVideo:
      send(.failure(Failure(code: .fileStalled, message: "Frames stopped reaching the file for \(thresholdMs) ms"), pauseReason: .fileError))
    case .fileBytes:
      send(.failure(Failure(code: .fileStalled, message: "The file has not grown for \(thresholdMs) ms"), pauseReason: .fileError))
    case .fileAudio:
      raiseWarning(.audioStalled, "Audio stopped reaching the file")
    }
  }

  private func checkFileGrowth(now: Double) {
    guard now - lastSizeCheck >= Self.fileSizeCheckInterval, let sessionId = manifest?.id else { return }
    lastSizeCheck = now
    let url = store.segmentURL(sessionId: sessionId, index: machine.state.segmentIndex)
    let bytes = Int64((try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize).flatMap { $0 } ?? 0)
    if bytes > lastFileBytes { pipeline.heartbeats.beat(.fileBytes, at: now) }
    lastFileBytes = bytes
  }

  private func checkFileRate(_ stats: MediaStats, now: Double) {
    let fps = stats.fileRate.rate(at: now)
    let isLow = stats.segmentSec > Self.fileFpsLowDuration && fps < Double(config.camera.fps) - Self.fileFpsTolerance
    switch fileFpsLow.update(isLow, at: now) {
    case .began: raiseWarning(.fileFpsLow, "File is recording at \(String(format: "%.1f", fps)) fps")
    case .ended: clearWarning(.fileFpsLow)
    case nil: break
    }
  }

  private func writeHeartbeat(_ stats: MediaStats, now: Double) {
    guard now - lastHeartbeat >= config.session.heartbeatIntervalSec else { return }
    lastHeartbeat = now
    manifest?.recordHeartbeat(lastVideoSec: stats.segmentSec, at: Date())
    persistManifest()
  }

  private func updateThermal() {
    let level = ThermalLevel(ProcessInfo.processInfo.thermalState)
    let profile = thermalPolicy.update(level: level, now: HostClock.now())
    guard profile != nil || level != machine.state.thermal else { return }
    log.log(profile == nil ? .info : .warning, "system", "Thermal level \(level.rawValue)", ["callProfile": thermalPolicy.current.rawValue])
    send(.thermalChanged(level, profile: profile))
  }

  private func checkDisk(now: Double) {
    lastDiskCheck = now
    guard let free = DiskSpace.availableBytes() else {
      log.warning("system", "iOS did not report free disk space")
      return
    }
    diskFreeBytes = free
    let freeMB = free / Self.bytesPerMegabyte
    if machine.state.phase == .recording, freeMB < Int64(config.storage.criticalFreeSpaceMB) {
      send(.failure(Failure(code: .diskFull, message: "Only \(freeMB) MB left"), pauseReason: .diskFull))
    } else if freeMB < Int64(config.storage.lowSpaceWarningMB) {
      raiseWarning(.diskSpaceLow, "\(freeMB) MB left, about \(minutesOfRecording(fitting: free)) min of recording")
    } else {
      clearWarning(.diskSpaceLow)
    }
  }

  private func requireFreeSpace() throws {
    guard let free = DiskSpace.availableBytes() else {
      log.warning("system", "iOS did not report free disk space; starting anyway")
      return
    }
    let freeMB = free / Self.bytesPerMegabyte
    guard freeMB >= Int64(config.storage.minFreeSpaceToStartMB) else {
      throw Failure(code: .diskFull, message: "Need \(config.storage.minFreeSpaceToStartMB) MB free to start, \(freeMB) MB available")
    }
  }

  private func minutesOfRecording(fitting bytes: Int64) -> Int64 {
    let bytesPerMinute = Int64(config.recording.videoBitrate + config.recording.audioBitrate) / 8 * 60
    return bytes / max(bytesPerMinute, 1)
  }

  private func healthSnapshot(_ stats: MediaStats, now: Double) -> HealthSnapshot {
    HealthSnapshot(
      at: Date(),
      camera: .init(fps: stats.cameraRate.rate(at: now), width: stats.cameraWidth, height: stats.cameraHeight),
      file: .init(
        fps: stats.fileRate.rate(at: now),
        droppedFrames: stats.fileDroppedFrames,
        bytes: lastFileBytes,
        segmentSec: stats.segmentSec,
        writer: stats.writerState
      ),
      audio: .init(
        levelDb: stats.audioLevelDb,
        lastBufferAgeMs: stats.lastAudioArrival > 0 ? (now - stats.lastAudioArrival) * 1000 : -1,
        driftMs: stats.audioDriftMs,
        resyncCount: stats.audioResyncCount,
        sampleRate: stats.audioSampleRate
      ),
      call: call.sendStats(),
      thermal: machine.state.thermal,
      systemPressure: monitor.systemPressure,
      audioRoute: routeMonitor.current,
      diskFreeBytes: diskFreeBytes
    )
  }

  private func apply(_ resolved: CaptureConfig) {
    config = resolved
    configCache.withLock { $0 = resolved }
    thermalPolicy = ThermalPolicy(profiles: resolved.call.thermalProfiles, recoveryDelay: resolved.call.thermalRecoveryDelaySec)
    healthMonitor = HealthMonitor(health: resolved.health)
    call.configure(call: resolved.call, audio: resolved.audio)
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
    let recordedSec = (manifest?.recordedSec ?? 0) + (machine.state.phase == .recording ? pipeline.statsSnapshot.segmentSec : 0)
    let snapshot = SessionSnapshot(state: machine.state, recordedSec: recordedSec)
    snapshotCache.withLock { $0 = snapshot }
    onSnapshot?(snapshot)
  }

  private func waitForPhase(in phases: Set<SessionPhase>) async -> SessionState {
    if phases.contains(machine.state.phase) { return machine.state }
    return await withCheckedContinuation { phaseWaiters.append((phases, $0)) }
  }

  private func resumeWaiters() {
    let state = machine.state
    let done = phaseWaiters.filter { $0.phases.contains(state.phase) }
    phaseWaiters.removeAll { $0.phases.contains(state.phase) }
    done.forEach { $0.continuation.resume(returning: state) }
  }

  private func invalidState(_ command: String) -> Failure {
    Failure(code: .invalidState, message: "Can't \(command) while \(machine.state.phase.rawValue)")
  }

  private func persistManifest() {
    if let manifest { save(manifest) }
  }

  private func save(_ manifest: SessionManifest) {
    let store = store
    let log = log
    ioQueue.async {
      do {
        try store.save(manifest)
      } catch {
        log.error("session", "Manifest write failed", ["error": error.localizedDescription])
      }
    }
  }

  private func saveVerification(_ report: VerificationReport) {
    let url = store.verificationURL(sessionId: report.sessionId)
    let log = log
    ioQueue.async {
      do {
        try RecordingStore.write(JSONCoding.encoder().encode(report), to: url)
      } catch {
        log.error("verify", "Verification report write failed", ["error": error.localizedDescription])
      }
    }
  }

  private func beginBackgroundTask() {
    guard backgroundTask == .invalid else { return }
    backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "capture-core.finish-segment") { [weak self] in
      self?.log.warning("session", "Background time expired before the segment finished")
      self?.endBackgroundTask()
    }
  }

  private func endBackgroundTask() {
    guard backgroundTask != .invalid else { return }
    UIApplication.shared.endBackgroundTask(backgroundTask)
    backgroundTask = .invalid
  }

  private func format(_ value: Double) -> String {
    String(format: "%.1f", value)
  }
}

extension SessionManifest.Device {
  @MainActor static var current: Self {
    var systemInfo = utsname()
    uname(&systemInfo)
    let model = withUnsafeBytes(of: &systemInfo.machine) { bytes in
      String(decoding: bytes.prefix { $0 != 0 }, as: UTF8.self)
    }
    let info = Bundle.main.infoDictionary
    let version = info?["CFBundleShortVersionString"] as? String ?? "?"
    let build = info?["CFBundleVersion"] as? String ?? "?"
    return Self(model: model, os: UIDevice.current.systemVersion, app: "\(version) (\(build))")
  }
}
