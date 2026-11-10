import Foundation

enum LogLevel: String, Codable, Sendable { case debug, info, warning, error }

struct LogEntry: Codable, Equatable, Sendable {
  var at: Date
  /// Host clock seconds; orders events across queues.
  var mono: Double
  var level: LogLevel
  var category: String
  var message: String
  var data: [String: String]?
}
