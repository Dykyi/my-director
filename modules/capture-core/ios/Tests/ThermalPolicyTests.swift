import Testing
@testable import CaptureCoreLogic

struct ThermalPolicyTests {
  private static let delay = 60.0

  private func policy(_ profiles: ThermalProfiles = CaptureConfig.defaults.call.thermalProfiles) -> ThermalPolicy {
    ThermalPolicy(profiles: profiles, recoveryDelay: Self.delay)
  }

  @Test func downgradeIsImmediate() {
    var policy = policy()
    #expect(policy.update(level: .serious, now: 0) == .reduced)
    #expect(policy.current == .reduced)
    #expect(policy.update(level: .critical, now: 1) == .minimal)
  }

  @Test func upgradeWaitsForRecoveryDelay() {
    var policy = policy()
    _ = policy.update(level: .serious, now: 0)
    #expect(policy.update(level: .nominal, now: 10) == nil)
    #expect(policy.update(level: .nominal, now: 69) == nil)
    #expect(policy.update(level: .nominal, now: 70) == .standard)
  }

  @Test func relapseRestartsTheWait() {
    var policy = policy()
    _ = policy.update(level: .serious, now: 0)
    _ = policy.update(level: .nominal, now: 10)
    #expect(policy.update(level: .serious, now: 40) == nil)
    #expect(policy.update(level: .nominal, now: 50) == nil)
    #expect(policy.update(level: .nominal, now: 109) == nil)
    #expect(policy.update(level: .nominal, now: 110) == .standard)
  }

  @Test func recoveryStepsThroughEachLevel() {
    var policy = policy()
    #expect(policy.update(level: .critical, now: 0) == .minimal)
    #expect(policy.update(level: .serious, now: 1) == nil)
    #expect(policy.update(level: .nominal, now: 60) == nil)
    #expect(policy.update(level: .nominal, now: 61) == .reduced)
    #expect(policy.update(level: .nominal, now: 120) == nil)
    #expect(policy.update(level: .nominal, now: 121) == .standard)
  }

  @Test func zeroDelayRestoresAtOnce() {
    var policy = ThermalPolicy(profiles: CaptureConfig.defaults.call.thermalProfiles, recoveryDelay: 0)
    _ = policy.update(level: .critical, now: 0)
    #expect(policy.update(level: .nominal, now: 1) == .standard)
  }

  @Test func flappingLevelsChangeProfileOnce() {
    var policy = policy()
    var changes = 0
    for tick in 0..<30 {
      let level: ThermalLevel = tick.isMultiple(of: 2) ? .serious : .fair
      if policy.update(level: level, now: Double(tick) * 10) != nil { changes += 1 }
    }
    #expect(changes == 1)
  }

  @Test func sameLevelIsNoChange() {
    var policy = policy()
    #expect(policy.update(level: .nominal, now: 0) == nil)
    #expect(policy.update(level: .fair, now: 1) == nil)
  }

  @Test func allStandardDisablesPolicy() {
    var policy = policy(ThermalProfiles(nominal: .standard, fair: .standard, serious: .standard, critical: .standard))
    #expect(ThermalLevel.allCases.allSatisfy { policy.update(level: $0, now: 0) == nil })
  }
}
