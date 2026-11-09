import Foundation

enum SessionId {
  static func make(at date: Date, suffix: UInt16 = .random(in: .min ... .max)) -> String {
    let timestamp = date.formatted(.iso8601).replacingOccurrences(of: ":", with: "-")
    return "\(timestamp)-\(String(format: "%04X", suffix))"
  }
}
