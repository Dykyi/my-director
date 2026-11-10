import Foundation

struct FrameRatePacer: Sendable {
  static let toleranceFraction = 0.25

  private(set) var targetFps: Double
  private var nextDue: Double?

  init(targetFps: Double) {
    self.targetFps = targetFps
  }

  mutating func retarget(fps: Double) {
    targetFps = fps
    nextDue = nil
  }

  mutating func shouldSend(at time: Double) -> Bool {
    let interval = 1 / targetFps
    guard let due = nextDue else {
      nextDue = time + interval
      return true
    }
    if time + interval * Self.toleranceFraction < due { return false }
    // After a camera gap longer than one interval, re-anchor instead of sending a catch-up burst.
    nextDue = time - due > interval ? time + interval : due + interval
    return true
  }
}
