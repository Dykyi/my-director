import Foundation
import Testing
@testable import CaptureCoreLogic

struct WithTimeoutTests {
  private struct TimedOut: Error, Equatable {}

  @Test func passesWhenTheOperationFinishesInTime() async throws {
    try await withTimeout(seconds: 1, throwing: TimedOut()) {}
  }

  @Test func throwsItsErrorWhenTimeRunsOut() async {
    await #expect(throws: TimedOut()) {
      try await withTimeout(seconds: 0.05, throwing: TimedOut()) {
        try await Task.sleep(for: .seconds(5))
      }
    }
  }

  @Test func passesTheOperationErrorThrough() async {
    await #expect(throws: CancellationError.self) {
      try await withTimeout(seconds: 1, throwing: TimedOut()) { throw CancellationError() }
    }
  }
}

struct PollTests {
  @Test func returnsOnceTheConditionHolds() async throws {
    var checks = 0
    let met = try await poll(every: .milliseconds(1), timeout: 1) {
      checks += 1
      return checks == 3
    }
    #expect(met)
    #expect(checks == 3)
  }

  @Test func givesUpWhenTimeRunsOut() async throws {
    #expect(try await poll(every: .milliseconds(5), timeout: 0.03) { false } == false)
  }

  @Test func cancellationEndsTheWaitAtOnce() async throws {
    let wait = Task { try await poll(every: .milliseconds(20), timeout: 15) { false } }
    try await Task.sleep(for: .milliseconds(30))
    let cancelledAt = ContinuousClock.now
    wait.cancel()
    await #expect(throws: CancellationError.self) { try await wait.value }
    #expect(ContinuousClock.now - cancelledAt < .milliseconds(100))
  }
}

struct WaitForBeatTests {
  @Test func seesABeatNewerThanTheStart() async throws {
    let board = HeartbeatBoard()
    board.beat(.camera, at: 10)
    #expect(try await board.waitForBeat(.camera, after: 5, timeout: 0.1))
  }

  @Test func ignoresOlderBeats() async throws {
    let board = HeartbeatBoard()
    board.beat(.camera, at: 1)
    #expect(try await board.waitForBeat(.camera, after: 5, timeout: 0.05) == false)
  }
}
