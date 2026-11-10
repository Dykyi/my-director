import Foundation

struct SustainedCondition: Sendable {
  enum Edge: Equatable, Sendable { case began, ended }

  let duration: Double
  private var since: Double?
  private var isActive = false

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
