import Foundation

struct RateMeter: Sendable {
  static let defaultWindow = 2.0

  private let window: Double
  private var times: [Double] = []

  init(window: Double = defaultWindow) {
    self.window = window
  }

  mutating func tick(at time: Double) {
    times.append(time)
    if let firstRecent = times.firstIndex(where: { $0 >= time - window }), firstRecent > 0 {
      times.removeFirst(firstRecent)
    }
  }

  func rate(at now: Double) -> Double {
    let recent = times.drop { $0 < now - window }
    guard let first = recent.first, let last = recent.last, last > first else { return 0 }
    return Double(recent.count - 1) / (last - first)
  }

  mutating func reset() {
    times.removeAll()
  }
}
