struct IntervalGate: Sendable {
  private let interval: Double
  private var last: Double

  init(every interval: Double, startingAt last: Double = 0) {
    self.interval = interval
    self.last = last
  }

  mutating func opens(at now: Double) -> Bool {
    guard now - last >= interval else { return false }
    last = now
    return true
  }
}
