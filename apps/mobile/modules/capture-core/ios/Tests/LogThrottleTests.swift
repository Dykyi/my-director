import Testing
@testable import CaptureCoreLogic

struct LogThrottleTests {
  @Test func logsTheFirstAndEveryNth() {
    let throttle = LogThrottle(every: 30)
    #expect((1...90).filter(throttle.allows) == [1, 30, 60, 90])
  }
}

struct OneDecimalTests {
  @Test func roundsToOneDecimal() {
    #expect(23.46.oneDecimal == "23.5")
    #expect((-8.04).oneDecimal == "-8.0")
  }
}
