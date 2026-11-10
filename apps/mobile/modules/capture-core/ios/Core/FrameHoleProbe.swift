import Foundation

struct FrameHoleProbe: Sendable {
  static let holeThreshold = 0.1

  struct Hole: Equatable, Sendable {
    var gap: Double
    var droppedFrames: [String: Int]
    var longestWork: String?
    var longestWorkDuration: Double
    var arrivalLag: Double
  }

  private var lastFrameTime: Double?
  private var droppedFrames: [String: Int] = [:]
  private var longestWork: (name: String, duration: Double)?

  mutating func dropped(reason: String) {
    droppedFrames[reason, default: 0] += 1
  }

  mutating func worked(_ name: String, for duration: Double) {
    if duration > longestWork?.duration ?? 0 { longestWork = (name, duration) }
  }

  mutating func frame(at time: Double, arrivalLag: Double) -> Hole? {
    defer {
      lastFrameTime = time
      droppedFrames = [:]
      longestWork = nil
    }
    guard let lastFrameTime, time - lastFrameTime > Self.holeThreshold else { return nil }
    return Hole(
      gap: time - lastFrameTime,
      droppedFrames: droppedFrames,
      longestWork: longestWork?.name,
      longestWorkDuration: longestWork?.duration ?? 0,
      arrivalLag: arrivalLag
    )
  }
}
