import Testing
@testable import CaptureCoreLogic

struct FrameRatePacerTests {
  private static let cameraFps = 30.0
  private static let startTime = 100.0
  private static let jitterPatternMs: [Double] = [0, 3, -3, 2, -2, 1, -1]

  private func cameraTimes(seconds: Double, jitter: Bool = false, dropped: Range<Int>? = nil) -> [Double] {
    (0..<Int(seconds * Self.cameraFps)).compactMap { index in
      if let dropped, dropped.contains(index) { return nil }
      let jitterMs = jitter ? Self.jitterPatternMs[index % Self.jitterPatternMs.count] : 0
      return Self.startTime + Double(index) / Self.cameraFps + jitterMs / 1000
    }
  }

  private func sent(_ times: [Double], target: Double) -> [Double] {
    var pacer = FrameRatePacer(targetFps: target)
    return times.filter { pacer.shouldSend(at: $0) }
  }

  private func averageRate(_ times: [Double]) throws -> Double {
    let first = try #require(times.first)
    let last = try #require(times.last)
    return Double(times.count - 1) / (last - first)
  }

  @Test(arguments: [30.0, 24.0, 15.0])
  func averageRateMatchesTarget(target: Double) throws {
    #expect(abs(try averageRate(sent(cameraTimes(seconds: 60), target: target)) - target) < 0.2)
  }

  @Test(arguments: [30.0, 24.0, 15.0])
  func jitterKeepsAverageRate(target: Double) throws {
    #expect(abs(try averageRate(sent(cameraTimes(seconds: 60, jitter: true), target: target)) - target) < 0.2)
  }

  @Test func everySecondHoldsTwentyFourFrames() {
    let out = sent(cameraTimes(seconds: 10), target: 24)
    for second in 0..<9 {
      let window = Self.startTime + Double(second)
      let count = out.filter { $0 >= window && $0 < window + 1 }.count
      #expect((23...25).contains(count), "second \(second) had \(count) frames")
    }
  }

  @Test(arguments: [30.0, 24.0, 15.0])
  func cameraGapDoesNotCauseBurst(target: Double) {
    let out = sent(cameraTimes(seconds: 20, dropped: 300..<305), target: target)
    let minInterval = zip(out, out.dropFirst()).map { $1 - $0 }.min() ?? 0
    #expect(minInterval >= 0.7 / target)
  }

  @Test func retargetChangesRate() throws {
    var pacer = FrameRatePacer(targetFps: 30)
    let times = cameraTimes(seconds: 20)
    _ = times.prefix(300).filter { pacer.shouldSend(at: $0) }
    pacer.retarget(fps: 15)
    let after = times.dropFirst(300).filter { pacer.shouldSend(at: $0) }
    #expect(abs(try averageRate(Array(after)) - 15) < 0.2)
  }
}
