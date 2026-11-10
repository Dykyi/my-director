import Testing
@testable import CaptureCoreLogic

struct FrameHoleProbeTests {
  private static let frameInterval = 1.0 / 30
  private static let startTime = 100.0
  private static let arrivalLag = 0.04

  private func feed(_ probe: inout FrameHoleProbe, count: Int, from start: Double = startTime) -> [FrameHoleProbe.Hole] {
    (0..<count).compactMap { index in
      probe.frame(at: start + Double(index) * Self.frameInterval, arrivalLag: Self.arrivalLag)
    }
  }

  @Test func steadyStreamHasNoHoles() {
    var probe = FrameHoleProbe()
    #expect(feed(&probe, count: 60).isEmpty)
  }

  @Test func oneMissingFrameIsNotAHole() {
    var probe = FrameHoleProbe()
    _ = feed(&probe, count: 10)
    #expect(probe.frame(at: Self.startTime + 11 * Self.frameInterval, arrivalLag: Self.arrivalLag) == nil)
  }

  @Test func holeCarriesDropsAndLongestWorkSinceThePreviousFrame() throws {
    var probe = FrameHoleProbe()
    _ = feed(&probe, count: 10)
    for _ in 0..<6 { probe.dropped(reason: "FrameWasLate") }
    probe.worked("audio", for: 0.004)
    probe.worked("video", for: 0.21)
    probe.worked("audio", for: 0.003)
    let last = Self.startTime + 9 * Self.frameInterval

    let next = probe.frame(at: last + 0.233, arrivalLag: 0.25)
    let hole = try #require(next)

    #expect(abs(hole.gap - 0.233) < 1e-9)
    #expect(hole.droppedFrames == ["FrameWasLate": 6])
    #expect(hole.longestWork == "video")
    #expect(abs(hole.longestWorkDuration - 0.21) < 1e-9)
    #expect(hole.arrivalLag == 0.25)
  }

  @Test func holeWithoutDropsMeansTheCameraSentNothing() throws {
    var probe = FrameHoleProbe()
    _ = feed(&probe, count: 10)
    let next = probe.frame(at: Self.startTime + 9 * Self.frameInterval + 0.392, arrivalLag: Self.arrivalLag)
    let hole = try #require(next)
    #expect(hole.droppedFrames.isEmpty)
    #expect(hole.longestWork == nil)
  }

  @Test func dropsAndWorkBeforeAnOnTimeFrameDoNotCarryOver() throws {
    var probe = FrameHoleProbe()
    _ = feed(&probe, count: 10)
    probe.dropped(reason: "OutOfBuffers")
    probe.worked("video", for: 0.05)
    _ = feed(&probe, count: 10, from: Self.startTime + 10 * Self.frameInterval)

    let next = probe.frame(at: Self.startTime + 19 * Self.frameInterval + 0.3, arrivalLag: Self.arrivalLag)
    let hole = try #require(next)

    #expect(hole.droppedFrames.isEmpty)
    #expect(hole.longestWork == nil)
  }
}
