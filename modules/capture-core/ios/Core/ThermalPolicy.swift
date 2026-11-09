import Foundation

struct ThermalPolicy: Sendable {
  private struct Recovery: Sendable {
    var since: Double
    var floor: CallProfileName
  }

  private let profiles: ThermalProfiles
  private let recoveryDelay: Double
  private(set) var current: CallProfileName
  private var recovery: Recovery?

  init(profiles: ThermalProfiles, recoveryDelay: Double) {
    self.profiles = profiles
    self.recoveryDelay = recoveryDelay
    current = profiles[.nominal]
  }

  mutating func update(level: ThermalLevel, now: Double) -> CallProfileName? {
    let target = profiles[level]
    if target.rank < current.rank {
      recovery = nil
      current = target
      return target
    }
    guard target.rank > current.rank else {
      recovery = nil
      return nil
    }
    var window = recovery ?? Recovery(since: now, floor: target)
    if target.rank < window.floor.rank { window.floor = target }
    guard now - window.since >= recoveryDelay else {
      recovery = window
      return nil
    }
    current = window.floor
    recovery = target.rank > current.rank ? Recovery(since: now, floor: target) : nil
    return current
  }
}
