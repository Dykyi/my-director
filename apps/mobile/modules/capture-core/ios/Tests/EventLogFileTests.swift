import Foundation
import Testing
@testable import CaptureCoreLogic

final class EventLogFileTests {
  private let directory = Fixtures.temporaryDirectory()
  private var url: URL { directory.appending(path: RecordingStore.eventsFileName) }

  init() throws {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  }

  deinit {
    try? FileManager.default.removeItem(at: directory)
  }

  private func entry(_ message: String) -> LogEntry {
    LogEntry(at: Fixtures.createdAt, mono: 1_234.5, level: .info, category: "machine", message: message, data: ["reason": "phoneCall"])
  }

  @Test func appendedEntriesReadBack() throws {
    let file = try EventLogFile(url: url)
    try file.append(entry("recording → pausing"))
    try file.append(entry("pausing → paused"))
    #expect(try EventLogFile.read(url).map(\.message) == ["recording → pausing", "pausing → paused"])
  }

  @Test func reopeningAppends() throws {
    try EventLogFile(url: url).append(entry("first"))
    try EventLogFile(url: url).append(entry("second"))
    #expect(try EventLogFile.read(url).map(\.message) == ["first", "second"])
  }

  @Test func lineCutByCrashIsSkipped() throws {
    try EventLogFile(url: url).append(entry("complete"))
    let handle = try FileHandle(forWritingTo: url)
    try handle.seekToEnd()
    try handle.write(contentsOf: Data("{\"at\":\"2027".utf8))
    try handle.close()
    #expect(try EventLogFile.read(url).map(\.message) == ["complete"])
  }
}

struct EventLogTests {
  @Test func aFinishedSessionGetsItsLineInItsOwnFile() throws {
    let queue = DispatchQueue(label: "test.log")
    let directory = Fixtures.temporaryDirectory()
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let newSession = directory.appending(path: "new.jsonl")
    let finishedSession = directory.appending(path: "finished.jsonl")
    let log = EventLog(subsystem: "test", ioQueue: queue)
    log.attachFile(at: newSession)
    log.log(.info, "verify", "Recording passed verification", file: finishedSession)
    queue.sync {}
    #expect(try EventLogFile.read(finishedSession).map(\.message) == ["Recording passed verification"])
    #expect(try EventLogFile.read(newSession).isEmpty)
  }
}
