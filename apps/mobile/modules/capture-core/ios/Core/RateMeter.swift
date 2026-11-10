import Foundation

struct RateMeter: Sendable {
  static let defaultWindow = 2.0

  private let window: Double
  private var times: [Double] = []

  init(window: Double = defaultWindow) {
    self.window = window
  }

  mutating func tick(at time: Double) {
    times.append(time)
    if let firstRecent = times.firstIndex(where: { $0 >= time - window }), firstRecent > 0 {
      times.removeFirst(firstRecent)
    }
  }

  func rate(at now: Double) -> Double {
    let recent = times.drop { $0 < now - window }
    guard let first = recent.first, let last = recent.last, last > first else { return 0 }
    return Double(recent.count - 1) / (last - first)
  }

  mutating func reset() {
    times.removeAll()
  }
}

struct SustainedCondition: Sendable {
  enum Edge: Equatable, Sendable { case began, ended }

  let duration: Double
  private var since: Double?
  private(set) var isActive = false

  init(duration: Double) {
    self.duration = duration
  }

  mutating func update(_ holds: Bool, at now: Double) -> Edge? {
    guard holds else {
      since = nil
      guard isActive else { return nil }
      isActive = false
      return .ended
    }
    let start = since ?? now
    since = start
    guard !isActive, now - start >= duration else { return nil }
    isActive = true
    return .began
  }
}
