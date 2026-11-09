import Foundation
import Testing
@testable import CaptureCoreLogic

struct SessionMachineTests {
  private static let now = Date(timeIntervalSince1970: 1_800_000_000)
  private static let sessionId = "2027-01-15T08-00-00Z-0001"
  private static let pauseEffects: [SessionEffect] = [.beginBackgroundTask, .closeSegment(1), .muteCall(true), .stopMic]

  private struct Run {
    var machine = SessionMachine()
    var lastEffects: [SessionEffect] = []
    var state: SessionState { machine.state }

    mutating func send(_ events: SessionEvent...) {
      for event in events { lastEffects = machine.handle(event, at: SessionMachineTests.now) }
    }
  }

  private func ready(policy: ResumePolicy = .manual) -> Run {
    var run = Run()
    run.send(.prepareRequested(policy), .cameraStarted)
    return run
  }

  private func recording(policy: ResumePolicy = .manual) -> Run {
    var run = ready(policy: policy)
    run.send(.startRequested(sessionId: Self.sessionId), .startSucceeded)
    return run
  }

  private func paused(by source: InterruptionSource, reason: PauseReason, policy: ResumePolicy = .manual) -> Run {
    var run = recording(policy: policy)
    run.send(.interruptionBegan(source, reason), .segmentClosed(index: 1, failure: nil))
    return run
  }

  @Test func fullSessionPath() {
    var run = ready()
    #expect(run.state.phase == .ready)
    run.send(.startRequested(sessionId: Self.sessionId))
    #expect(run.state.phase == .starting)
    #expect(run.lastEffects == [.runStartSequence(sessionId: Self.sessionId)])
    run.send(.startSucceeded)
    #expect(run.state.phase == .recording)
    #expect(run.lastEffects == [.openSegment(1), .persistManifest, .setIdleTimerDisabled(true)])
    run.send(.stopRequested)
    #expect(run.lastEffects == [.runStopSequence])
    run.send(.segmentClosed(index: 1, failure: nil))
    #expect(run.lastEffects == [.persistManifest])
    run.send(.stopFinished)
    #expect(run.state.phase == .ready)
    #expect(run.state.sessionId == nil)
    #expect(run.lastEffects == [.finishSession, .setIdleTimerDisabled(false)])
  }

  @Test func phoneCallScenarioB() {
    var run = recording()
    run.send(.interruptionBegan(.audioSession, .phoneCall))
    #expect(run.state.phase == .pausing)
    #expect(run.state.pauseReason == .phoneCall)
    #expect(run.lastEffects == Self.pauseEffects)
    run.send(.segmentClosed(index: 1, failure: nil))
    #expect(run.state.phase == .paused)
    #expect(run.lastEffects == [.persistManifest, .endBackgroundTask])
    run.send(.interruptionEnded(.audioSession))
    #expect(run.lastEffects.isEmpty)
    run.send(.resumeRequested)
    #expect(run.state.phase == .resuming)
    #expect(run.lastEffects == [.runResumeSequence])
    run.send(.resumeSucceeded)
    #expect(run.state.phase == .recording)
    #expect(run.state.segmentIndex == 2)
    #expect(run.lastEffects == [.openSegment(2), .persistManifest])
  }

  @Test(arguments: [true, false])
  func backgroundScenarioCBlocksResumeUntilForeground(cameraFirst: Bool) {
    var run = recording()
    let background = SessionEvent.interruptionBegan(.appBackground, .appBackground)
    let camera = SessionEvent.interruptionBegan(.camera, .cameraInterrupted)
    run.send(cameraFirst ? camera : background, cameraFirst ? background : camera)
    run.send(.segmentClosed(index: 1, failure: nil))
    #expect(run.state.pauseReason == (cameraFirst ? .cameraInterrupted : .appBackground))
    run.send(.resumeRequested)
    #expect(run.state.phase == .paused)
    #expect(run.state.error?.code == .resumeBlocked)
    run.send(.interruptionEnded(.appBackground), .appBecameActive)
    #expect(run.state.interruptions.isEmpty)
    run.send(.resumeRequested)
    #expect(run.state.phase == .resuming)
    #expect(run.state.error == nil)
  }

  @Test func appBecameActiveClearsAudioInterruptionWithoutEnded() {
    var run = paused(by: .audioSession, reason: .phoneCall)
    run.send(.appBecameActive, .resumeRequested)
    #expect(run.state.phase == .resuming)
  }

  @Test func automaticResumeAfterPhoneCall() {
    var run = paused(by: .audioSession, reason: .phoneCall, policy: .automatic)
    run.send(.interruptionEnded(.audioSession))
    #expect(run.state.phase == .resuming)
    #expect(run.lastEffects == [.runResumeSequence])
  }

  @Test func automaticResumeWaitsForForeground() {
    var run = paused(by: .appBackground, reason: .appBackground, policy: .automatic)
    run.send(.interruptionEnded(.appBackground))
    #expect(run.state.phase == .paused)
    run.send(.appBecameActive)
    #expect(run.lastEffects == [.runResumeSequence])
  }

  @Test func automaticResumeWhenSegmentClosesAfterInterruptionEnded() {
    var run = recording(policy: .automatic)
    run.send(.interruptionBegan(.audioSession, .phoneCall), .interruptionEnded(.audioSession))
    #expect(run.state.phase == .pausing)
    run.send(.segmentClosed(index: 1, failure: nil))
    #expect(run.state.phase == .resuming)
    #expect(run.lastEffects == [.persistManifest, .endBackgroundTask, .runResumeSequence])
  }

  @Test func automaticResumeSkipsPipelineFailures() {
    var run = recording(policy: .automatic)
    run.send(.failure(Failure(code: .cameraStalled, message: "no frames"), pauseReason: .cameraStalled))
    run.send(.segmentClosed(index: 1, failure: nil), .appBecameActive)
    #expect(run.state.phase == .paused)
    #expect(run.lastEffects.isEmpty)
  }

  @Test func resumeFailureReturnsToPaused() {
    var run = paused(by: .audioSession, reason: .phoneCall)
    run.send(.appBecameActive, .resumeRequested, .resumeFailed(Failure(code: .micUnavailable, message: "call in progress")))
    #expect(run.state.phase == .paused)
    #expect(run.state.error?.code == .micUnavailable)
  }

  @Test func interruptionDuringResumeCancelsIt() {
    var run = paused(by: .audioSession, reason: .phoneCall)
    run.send(.appBecameActive, .resumeRequested, .interruptionBegan(.audioSession, .phoneCall))
    #expect(run.state.phase == .paused)
    #expect(run.lastEffects == [.cancelResumeSequence])
  }

  @Test func writerFailurePausesAndWarns() {
    var run = recording()
    let failure = Failure(code: .fileWriterFailed, message: "AVFoundation error -11800")
    run.send(.failure(failure, pauseReason: .fileError))
    #expect(run.state.phase == .pausing)
    #expect(run.state.pauseReason == .fileError)
    #expect(run.state.error?.code == .fileWriterFailed)
    run.send(.segmentClosed(index: 1, failure: failure))
    #expect(run.state.phase == .paused)
    #expect(run.state.warnings[.fileWriterFailed] != nil)
  }

  @Test func stopWhilePaused() {
    var run = paused(by: .audioSession, reason: .phoneCall)
    run.send(.stopRequested)
    #expect(run.state.phase == .stopping)
    #expect(run.lastEffects == [.runStopSequence])
  }

  @Test func stopWhilePausingWaitsForTheSegment() {
    var run = recording()
    run.send(.pauseRequested, .stopRequested)
    #expect(run.state.phase == .stopping)
    #expect(run.lastEffects == [.runStopSequence])
  }

  @Test func writerFailureWhileStoppingWarns() {
    var run = recording()
    run.send(.stopRequested, .segmentClosed(index: 1, failure: Failure(code: .fileWriterFailed, message: "-11800")))
    #expect(run.state.phase == .stopping)
    #expect(run.state.warnings[.fileWriterFailed]?.message == "-11800")
    #expect(run.lastEffects == [.persistManifest])
  }

  @Test func stopWhileResumingCancelsResume() {
    var run = paused(by: .audioSession, reason: .phoneCall)
    run.send(.appBecameActive, .resumeRequested, .stopRequested)
    #expect(run.lastEffects == [.cancelResumeSequence, .runStopSequence])
  }

  @Test func repeatedInterruptionIsIdempotent() {
    var run = recording()
    run.send(.interruptionBegan(.camera, .cameraInterrupted), .interruptionBegan(.camera, .cameraInterrupted))
    #expect(run.state.interruptions == [.camera])
    #expect(run.lastEffects.isEmpty)
  }

  @Test func callLossWarnsWithoutPausing() {
    var run = recording()
    run.send(.callChanged(CallStatus(state: .reconnecting, room: "mydirector-poc")))
    #expect(run.state.phase == .recording)
    #expect(run.state.warnings[.callDisconnected] != nil)
    run.send(.callChanged(CallStatus(state: .connected, room: "mydirector-poc")))
    #expect(run.state.warnings[.callDisconnected] == nil)
  }

  @Test func callConnectingDuringStartIsNotACallLoss() {
    var run = ready()
    run.send(.startRequested(sessionId: Self.sessionId), .callChanged(CallStatus(state: .connecting, room: "mydirector-poc")))
    #expect(run.state.warnings.isEmpty)
    run.send(.startFailed(Failure(code: .callConnectFailed, message: "timeout")))
    #expect(run.state.warnings.isEmpty)
  }

  @Test func stopKeepsOnlyDeviceWarnings() {
    var run = recording()
    run.send(
      .warningRaised(code: .diskSpaceLow, message: "1.0 GB left"),
      .warningRaised(code: .fileFpsLow, message: "26 fps"),
      .callChanged(CallStatus(state: .reconnecting, room: "mydirector-poc")),
      .failure(Failure(code: .fileWriterFailed, message: "-11800"), pauseReason: .fileError),
      .segmentClosed(index: 1, failure: Failure(code: .fileWriterFailed, message: "-11800")),
      .stopRequested,
      .stopFinished
    )
    #expect(Set(run.state.warnings.keys) == [.diskSpaceLow])
  }

  @Test func failedStartKeepsOnlyDeviceWarnings() {
    var run = ready()
    run.send(
      .warningRaised(code: .diskSpaceLow, message: "1.0 GB left"),
      .startRequested(sessionId: Self.sessionId),
      .warningRaised(code: .callPublishFailed, message: "publish timeout"),
      .startFailed(Failure(code: .callPublishFailed, message: "publish timeout"))
    )
    #expect(Set(run.state.warnings.keys) == [.diskSpaceLow])
  }

  @Test func pauseClearsSegmentWatcherWarnings() {
    var run = recording()
    run.send(
      .warningRaised(code: .diskSpaceLow, message: "1.0 GB left"),
      .warningRaised(code: .audioStalled, message: "no audio for 2 s"),
      .warningRaised(code: .fileFpsLow, message: "26 fps"),
      .callChanged(CallStatus(state: .reconnecting, room: "mydirector-poc")),
      .pauseRequested
    )
    #expect(Set(run.state.warnings.keys) == [.diskSpaceLow, .callDisconnected])
  }

  @Test func callStatusKeepsMachineOwnedProfile() {
    var run = recording()
    run.send(.thermalChanged(.serious, profile: .reduced))
    run.send(.callChanged(CallStatus(state: .connected, room: "mydirector-poc")))
    #expect(run.state.call.profile == .reduced)
  }

  @Test func interruptedStartReturnsToReady() {
    var run = ready()
    run.send(.startRequested(sessionId: Self.sessionId), .interruptionBegan(.appBackground, .appBackground))
    #expect(run.state.phase == .ready)
    #expect(run.state.error?.code == .startInterrupted)
    #expect(run.lastEffects == [.abortStart])
  }

  @Test func failedStartReturnsToReady() {
    var run = ready()
    run.send(.startRequested(sessionId: Self.sessionId), .startFailed(Failure(code: .callConnectFailed, message: "timeout")))
    #expect(run.state.phase == .ready)
    #expect(run.state.sessionId == nil)
    #expect(run.state.error?.code == .callConnectFailed)
    #expect(run.lastEffects == [.abortStart])
  }

  @Test func thermalChangeAppliesProfileOnce() {
    var run = recording()
    run.send(.thermalChanged(.serious, profile: .reduced))
    #expect(run.lastEffects == [.applyCallProfile(.reduced)])
    run.send(.thermalChanged(.serious, profile: nil))
    #expect(run.lastEffects.isEmpty)
  }

  @Test func screenLockRefinesBackgroundReason() {
    var run = paused(by: .appBackground, reason: .appBackground)
    run.send(.screenLocked)
    #expect(run.state.pauseReason == .screenLocked)
  }

  @Test func ignoredEventLeavesStateUntouched() {
    var run = ready()
    let before = run.state
    run.send(.resumeRequested)
    #expect(run.state == before)
    #expect(run.lastEffects.isEmpty)
  }
}
