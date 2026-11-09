import Foundation

final class EventLogFile {
  private static let newline = UInt8(ascii: "\n")
  private let handle: FileHandle
  private let encoder = JSONCoding.encoder()

  init(url: URL) throws {
    if !FileManager.default.fileExists(atPath: url.path(percentEncoded: false)) {
      try RecordingStore.write(Data(), to: url)
    }
    handle = try FileHandle(forWritingTo: url)
    try handle.seekToEnd()
  }

  deinit {
    try? handle.close()
  }

  func append(_ entry: LogEntry) throws {
    var line = try encoder.encode(entry)
    line.append(Self.newline)
    try handle.write(contentsOf: line)
  }

  static func read(_ url: URL) throws -> [LogEntry] {
    let decoder = JSONCoding.decoder()
    return try Data(contentsOf: url)
      .split(separator: newline)
      .compactMap { try? decoder.decode(LogEntry.self, from: Data($0)) }
  }
}
