import os

final class HeartbeatBoard: Sendable {
  private let beats = OSAllocatedUnfairLock(initialState: [HeartbeatSource: Double]())

  func beat(_ source: HeartbeatSource, at time: Double) {
    beats.withLock { $0[source] = time }
  }

  func snapshot() -> [HeartbeatSource: Double] {
    beats.withLock { $0 }
  }
}

extension HeartbeatBoard {
  private static let pollInterval = Duration.milliseconds(50)

  func waitForBeat(_ source: HeartbeatSource, after: Double, timeout: Double) async throws -> Bool {
    try await poll(every: Self.pollInterval, timeout: timeout) { (snapshot()[source] ?? -.infinity) > after }
  }
}
