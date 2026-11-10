import CoreMedia

let nanosecondTimescale: CMTimeScale = 1_000_000_000

enum HostClock {
  static func now() -> Double {
    CMClockGetTime(CMClockGetHostTimeClock()).seconds
  }
}
