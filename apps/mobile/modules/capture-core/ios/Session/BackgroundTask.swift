import UIKit

@MainActor
final class BackgroundTask {
  private static let name = "capture-core.finish-segment"

  private let log: EventLog
  private var identifier = UIBackgroundTaskIdentifier.invalid

  nonisolated init(log: EventLog) {
    self.log = log
  }

  func begin() {
    guard identifier == .invalid else { return }
    identifier = UIApplication.shared.beginBackgroundTask(withName: Self.name) { [weak self] in
      self?.log.warning("session", "Background time expired before the segment finished")
      self?.end()
    }
  }

  func end() {
    guard identifier != .invalid else { return }
    UIApplication.shared.endBackgroundTask(identifier)
    identifier = .invalid
  }
}
