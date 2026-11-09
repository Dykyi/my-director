import Foundation
import os

struct UploadEventLog {
  private struct Line: Encodable {
    var at: Date
    var message: String
    var data: [String: String]?
  }

  private static let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "background-upload", category: "upload")

  let store: UploadJobStore

  func append(_ jobId: String, _ message: String, _ data: [String: String]? = nil) {
    Self.logger.info("\(jobId, privacy: .public) \(message, privacy: .public)")
    do {
      var line = try UploadCoding.encoder().encode(Line(at: .now, message: message, data: data))
      line.append(0x0A)
      let url = store.eventsURL(for: jobId)
      if !FileManager.default.fileExists(atPath: url.path(percentEncoded: false)) {
        try store.write(Data(), to: url)
      }
      let handle = try FileHandle(forWritingTo: url)
      defer { try? handle.close() }
      try handle.seekToEnd()
      try handle.write(contentsOf: line)
    } catch {
      Self.logger.error("events.jsonl write failed: \(error.localizedDescription, privacy: .public)")
    }
  }
}
