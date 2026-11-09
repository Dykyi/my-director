import Foundation

struct SessionState: Equatable, Sendable {
  var phase: SessionPhase = .idle
  var sessionId: String?
  var segmentIndex = 0
  var pauseReason: PauseReason?
  var interruptions: Set<InterruptionSource> = []
  var appActive = true
  var call = CallStatus()
  var thermal: ThermalLevel = .nominal
  var error: CaptureError?
  var warnings: [CaptureErrorCode: CaptureWarning] = [:]
  var resumePolicy: ResumePolicy = .manual

  var hasSession: Bool { sessionId != nil }
}

enum SessionEvent: Equatable, Sendable {
  case prepareRequested(ResumePolicy)
  case cameraStarted
  case cameraFailed(Failure)
  case startRequested(sessionId: String)
  case startSucceeded
  case startFailed(Failure)
  case pauseRequested
  case resumeRequested
  case resumeSucceeded
  case resumeFailed(Failure)
  case stopRequested
  case stopFinished
  case interruptionBegan(InterruptionSource, PauseReason)
  case interruptionEnded(InterruptionSource)
  case appBecameActive
  case screenLocked
  case segmentClosed(index: Int, failure: Failure?)
  case failure(Failure, pauseReason: PauseReason)
  case warningRaised(code: CaptureErrorCode, message: String)
  case warningCleared(CaptureErrorCode)
  case callChanged(CallStatus)
  case thermalChanged(ThermalLevel, profile: CallProfileName?)
  case errorDismissed
}

enum SessionEffect: Equatable, Sendable {
  case startCamera
  case runStartSequence(sessionId: String)
  case abortStart
  case openSegment(Int)
  case closeSegment(Int)
  case muteCall(Bool)
  case stopMic
  case runResumeSequence
  case cancelResumeSequence
  case runStopSequence
  case finishSession
  case beginBackgroundTask
  case endBackgroundTask
  case setIdleTimerDisabled(Bool)
  case persistManifest
  case applyCallProfile(CallProfileName)
}

struct SessionMachine: Sendable {
  private static let deviceWarnings: Set<CaptureErrorCode> = [.diskSpaceLow]
  private static let segmentWarnings: Set<CaptureErrorCode> = [.audioStalled, .fileFpsLow]
  private static let callWarningPhases: Set<SessionPhase> = [.recording, .pausing, .paused]

  private(set) var state = SessionState()

  mutating func handle(_ event: SessionEvent, at now: Date) -> [SessionEffect] {
    switch (state.phase, event) {
    case (.idle, .prepareRequested(let policy)), (.ready, .prepareRequested(let policy)):
      state.resumePolicy = policy
      state.phase = .preparing
      state.error = nil
      return [.startCamera]

    case (.preparing, .cameraStarted):
      state.phase = .ready
      return []

    case (.preparing, .cameraFailed(let failure)):
      state.phase = .idle
      state.error = CaptureError(failure, at: now)
      return []

    case (.ready, .startRequested(let sessionId)):
      state.phase = .starting
      state.sessionId = sessionId
      state.segmentIndex = 0
      state.pauseReason = nil
      state.error = nil
      return [.runStartSequence(sessionId: sessionId)]

    case (.starting, .startSucceeded):
      state.phase = .recording
      state.segmentIndex = 1
      return [.openSegment(1), .persistManifest, .setIdleTimerDisabled(true)]

    case (.starting, .startFailed(let failure)):
      return abortStart(failure, at: now)

    case (.starting, .interruptionBegan(let source, _)):
      noteInterruption(source)
      return abortStart(Failure(code: .startInterrupted, message: "Start was interrupted (\(source.rawValue))"), at: now)

    case (.recording, .pauseRequested):
      return pause(.user)

    case (.recording, .interruptionBegan(let source, let reason)):
      noteInterruption(source)
      return pause(reason)

    case (.recording, .failure(let failure, let reason)):
      state.error = CaptureError(failure, at: now)
      return pause(reason)

    case (.pausing, .segmentClosed(_, let failure)):
      state.phase = .paused
      if let failure { warn(.fileWriterFailed, failure.message, at: now) }
      return [.persistManifest, .endBackgroundTask] + autoResumeIfAllowed()

    case (.stopping, .segmentClosed(_, let failure)):
      if let failure { warn(.fileWriterFailed, failure.message, at: now) }
      return [.persistManifest]

    case (.resuming, .interruptionBegan(let source, let reason)):
      noteInterruption(source)
      state.phase = .paused
      state.pauseReason = reason
      return [.cancelResumeSequence]

    case (_, .interruptionBegan(let source, _)):
      noteInterruption(source)
      return []

    case (_, .interruptionEnded(let source)):
      state.interruptions.remove(source)
      return autoResumeIfAllowed()

    case (_, .appBecameActive):
      state.appActive = true
      state.interruptions.removeAll()
      return autoResumeIfAllowed()

    case (.pausing, .screenLocked), (.paused, .screenLocked):
      if state.pauseReason == .appBackground { state.pauseReason = .screenLocked }
      return []

    case (.paused, .resumeRequested):
      guard state.interruptions.isEmpty else {
        let sources = state.interruptions.sorted().map(\.rawValue).joined(separator: ", ")
        state.error = CaptureError(Failure(code: .resumeBlocked, message: "Can't resume while interrupted: \(sources)"), at: now)
        return []
      }
      return beginResume()

    case (.resuming, .resumeSucceeded):
      state.phase = .recording
      state.segmentIndex += 1
      state.pauseReason = nil
      return [.openSegment(state.segmentIndex), .persistManifest]

    case (.resuming, .resumeFailed(let failure)):
      state.phase = .paused
      state.error = CaptureError(failure, at: now)
      return []

    case (.recording, .stopRequested), (.pausing, .stopRequested), (.paused, .stopRequested):
      state.phase = .stopping
      return [.runStopSequence]

    case (.resuming, .stopRequested):
      state.phase = .stopping
      return [.cancelResumeSequence, .runStopSequence]

    case (.stopping, .stopFinished):
      state.phase = .ready
      state.sessionId = nil
      state.segmentIndex = 0
      state.pauseReason = nil
      keepOnlyDeviceWarnings()
      return [.finishSession, .setIdleTimerDisabled(false)]

    case (_, .failure(let failure, _)):
      state.error = CaptureError(failure, at: now)
      return []

    case (_, .warningRaised(let code, let message)):
      warn(code, message, at: now)
      return []

    case (_, .warningCleared(let code)):
      state.warnings.removeValue(forKey: code)
      return []

    case (_, .callChanged(let status)):
      let profile = state.call.profile
      state.call = status
      state.call.profile = profile
      if status.state == .connected {
        state.warnings.removeValue(forKey: .callDisconnected)
      } else if Self.callWarningPhases.contains(state.phase) {
        warn(.callDisconnected, "Call \(status.state.rawValue), recording continues", at: now)
      }
      return []

    case (_, .thermalChanged(let level, let profile)):
      state.thermal = level
      guard let profile, profile != state.call.profile else { return [] }
      state.call.profile = profile
      return [.applyCallProfile(profile)]

    case (_, .errorDismissed):
      state.error = nil
      return []

    default:
      return []
    }
  }

  private mutating func pause(_ reason: PauseReason) -> [SessionEffect] {
    state.phase = .pausing
    state.pauseReason = reason
    state.warnings = state.warnings.filter { !Self.segmentWarnings.contains($0.key) }
    return [.beginBackgroundTask, .closeSegment(state.segmentIndex), .muteCall(true), .stopMic]
  }

  private mutating func abortStart(_ failure: Failure, at now: Date) -> [SessionEffect] {
    state.phase = .ready
    state.sessionId = nil
    state.error = CaptureError(failure, at: now)
    keepOnlyDeviceWarnings()
    return [.abortStart]
  }

  private mutating func keepOnlyDeviceWarnings() {
    state.warnings = state.warnings.filter { Self.deviceWarnings.contains($0.key) }
  }

  private mutating func beginResume() -> [SessionEffect] {
    state.phase = .resuming
    state.error = nil
    return [.runResumeSequence]
  }

  private mutating func autoResumeIfAllowed() -> [SessionEffect] {
    guard state.phase == .paused,
          state.resumePolicy == .automatic,
          state.interruptions.isEmpty,
          state.appActive,
          state.pauseReason?.isSystemInterruption == true
    else { return [] }
    return beginResume()
  }

  private mutating func noteInterruption(_ source: InterruptionSource) {
    state.interruptions.insert(source)
    if source == .appBackground { state.appActive = false }
  }

  private mutating func warn(_ code: CaptureErrorCode, _ message: String, at now: Date) {
    guard state.warnings[code] == nil else { return }
    state.warnings[code] = CaptureWarning(code: code, message: message, since: now)
  }
}
