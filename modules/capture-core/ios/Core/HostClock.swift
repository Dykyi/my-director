import CoreMedia

enum HostClock {
  static func now() -> Double {
    CMClockGetTime(CMClockGetHostTimeClock()).seconds
  }
}
