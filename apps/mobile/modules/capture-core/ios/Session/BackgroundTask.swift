import UIKit

@MainActor
final class BackgroundTask {
  private let name: String
  private let expiredMessage: String
  private let log: EventLog
  private var identifier = UIBackgroundTaskIdentifier.invalid

  nonisolated init(name: String, expiredMessage: String, log: EventLog) {
    self.name = name
    self.expiredMessage = expiredMessage
    self.log = log
  }

  func begin() {
    guard identifier == .invalid else { return }
    identifier = UIApplication.shared.beginBackgroundTask(withName: name) { [weak self] in
      guard let self else { return }
      log.warning("session", expiredMessage)
      end()
    }
  }

  func end() {
    guard identifier != .invalid else { return }
    UIApplication.shared.endBackgroundTask(identifier)
    identifier = .invalid
  }
}
