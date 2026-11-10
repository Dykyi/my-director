import Foundation
import os

final class EventLog: @unchecked Sendable {
  typealias Listener = @Sendable (LogEntry) -> Void

  private let subsystem: String
  private let ioQueue: DispatchQueue
  private let listener = OSAllocatedUnfairLock<Listener?>(initialState: nil)
  private var file: EventLogFile?

  init(subsystem: String, ioQueue: DispatchQueue) {
    self.subsystem = subsystem
    self.ioQueue = ioQueue
  }

  func setListener(_ listener: Listener?) {
    self.listener.withLock { $0 = listener }
  }

  func attachFile(at url: URL?) {
    ioQueue.async {
      self.file = nil
      guard let url else { return }
      do {
        self.file = try EventLogFile(url: url)
      } catch {
        self.osLogger("log").error("events.jsonl unavailable: \(error.localizedDescription, privacy: .public)")
      }
    }
  }

  /// `file` takes the line instead of the attached events.jsonl: the session it belongs to has finished.
  func log(_ level: LogLevel, _ category: String, _ message: String, _ data: [String: String]? = nil, file: URL? = nil) {
    let entry = LogEntry(at: Date(), mono: HostClock.now(), level: level, category: category, message: message, data: data)
    let details = data?.sorted { $0.key < $1.key }.map { "\($0.key)=\($0.value)" }.joined(separator: " ") ?? ""
    osLogger(category).log(level: level.osLogType, "\(message, privacy: .public) \(details, privacy: .public)")
    listener.withLock { $0 }?(entry)
    ioQueue.async {
      do {
        if let file { try EventLogFile(url: file).append(entry) } else { try self.file?.append(entry) }
      } catch {
        self.osLogger("log").error("events.jsonl append failed: \(error.localizedDescription, privacy: .public)")
      }
    }
  }

  func info(_ category: String, _ message: String, _ data: [String: String]? = nil) {
    log(.info, category, message, data)
  }

  func warning(_ category: String, _ message: String, _ data: [String: String]? = nil) {
    log(.warning, category, message, data)
  }

  func error(_ category: String, _ message: String, _ data: [String: String]? = nil) {
    log(.error, category, message, data)
  }

  private func osLogger(_ category: String) -> Logger {
    Logger(subsystem: subsystem, category: category)
  }
}

private extension LogLevel {
  var osLogType: OSLogType {
    switch self {
    case .debug: .debug
    case .info: .info
    case .warning: .default
    case .error: .error
    }
  }
}
