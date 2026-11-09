import Foundation

struct ThermalPolicy: Sendable {
  private let profiles: ThermalProfiles
  private let recoveryDelay: Double
  private(set) var current: CallProfileName
  private var betterSince: Double?

  init(profiles: ThermalProfiles, recoveryDelay: Double) {
    self.profiles = profiles
    self.recoveryDelay = recoveryDelay
    current = profiles[.nominal]
  }

  mutating func update(level: ThermalLevel, now: Double) -> CallProfileName? {
    let target = profiles[level]
    if target.rank < current.rank {
      betterSince = nil
      current = target
      return target
    }
    guard target.rank > current.rank else {
      betterSince = nil
      return nil
    }
    let since = betterSince ?? now
    betterSince = since
    guard now - since >= recoveryDelay else { return nil }
    betterSince = nil
    current = target
    return target
  }
}
