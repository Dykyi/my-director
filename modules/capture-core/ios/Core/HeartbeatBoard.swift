import os

final class HeartbeatBoard: Sendable {
  private let beats = OSAllocatedUnfairLock(initialState: [Pipeline: Double]())

  func beat(_ pipeline: Pipeline, at time: Double) {
    beats.withLock { $0[pipeline] = time }
  }

  func snapshot() -> [Pipeline: Double] {
    beats.withLock { $0 }
  }
}
