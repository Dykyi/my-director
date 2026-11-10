import Foundation

struct FileRateWatch: Sendable {
  private static let warmUpSec = 3.0
  private static let sustainSec = 3.0
  private static let toleranceFps = 0.5

  private let targetFps: Double
  private var low = SustainedCondition(duration: sustainSec)

  init(targetFps: Int) {
    self.targetFps = Double(targetFps)
  }

  mutating func update(fps: Double, segmentSec: Double, at now: Double) -> HealthReaction? {
    let isLow = segmentSec > Self.warmUpSec && fps < targetFps - Self.toleranceFps
    switch low.update(isLow, at: now) {
    case .began: return .warn(.fileFpsLow, "File is recording at \(fps.oneDecimal) fps")
    case .ended: return .clearWarning(.fileFpsLow)
    case nil: return nil
    }
  }
}
