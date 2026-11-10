import Foundation

/// UTC start time plus a random suffix: sorts by time and is safe as a folder name.
enum SessionId {
  static func make(at date: Date, suffix: UInt16 = .random(in: .min ... .max)) -> String {
    let timestamp = date.formatted(.iso8601).replacingOccurrences(of: ":", with: "-")
    return "\(timestamp)-\(String(format: "%04X", suffix))"
  }
}
