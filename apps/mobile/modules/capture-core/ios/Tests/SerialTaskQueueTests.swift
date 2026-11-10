import Testing
@testable import CaptureCoreLogic

@MainActor
private final class Journal {
  var lines: [String] = []
}

@MainActor
struct SerialTaskQueueTests {
  @Test func runsWorkOneAtATimeInOrder() async {
    let queue = SerialTaskQueue()
    let journal = Journal()
    queue.enqueue {
      journal.lines.append("first started")
      try? await Task.sleep(for: .milliseconds(20))
      journal.lines.append("first finished")
    }
    await queue.enqueue { journal.lines.append("second") }.value
    #expect(journal.lines == ["first started", "first finished", "second"])
  }
}

@MainActor
struct PhaseWaitersTests {
  @Test func returnsAtOnceWhenThePhaseIsReached() async {
    let waiters = PhaseWaiters()
    let state = SessionState(phase: .ready)
    #expect(await waiters.wait(for: [.ready], current: state) == state)
  }

  @Test func resumesOnlyWaitersOfTheNewPhase() async {
    let waiters = PhaseWaiters()
    let journal = Journal()
    let ready = Task { journal.lines.append("\(await waiters.wait(for: [.ready], current: SessionState()).phase)") }
    let paused = Task { journal.lines.append("\(await waiters.wait(for: [.paused], current: SessionState()).phase)") }
    await Task.yield()
    waiters.resume(with: SessionState(phase: .ready))
    await ready.value
    #expect(journal.lines == ["ready"])
    waiters.resume(with: SessionState(phase: .paused))
    await paused.value
    #expect(journal.lines == ["ready", "paused"])
  }
}
