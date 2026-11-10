import Foundation
import os
import Testing
@testable import CaptureCoreLogic

struct SessionFilesTests {
  private let queue = DispatchQueue(label: "test.io")
  private let store = RecordingStore(root: Fixtures.temporaryDirectory())
  private let entries = OSAllocatedUnfairLock<[LogEntry]>(initialState: [])
  private let files: SessionFiles

  init() {
    let log = EventLog(subsystem: "test", ioQueue: queue)
    log.setListener { [entries] entry in entries.withLock { $0.append(entry) } }
    files = SessionFiles(store: store, log: log, queue: queue)
  }

  @Test func savesTheManifestOffTheCaller() throws {
    var manifest = Fixtures.manifest()
    try store.create(manifest)
    manifest.room = "another-room"
    files.save(manifest)
    queue.sync {}
    #expect(try store.load(manifest.id).room == "another-room")
  }

  @Test func savesTheVerificationReport() throws {
    try store.create(Fixtures.manifest())
    files.save(VerificationReport(sessionId: Fixtures.sessionId, verifiedAt: Fixtures.createdAt, segments: [], pass: true))
    queue.sync {}
    #expect(FileManager.default.fileExists(atPath: store.verificationURL(sessionId: Fixtures.sessionId).path(percentEncoded: false)))
  }

  @Test func aFailedDeleteGoesToTheLog() {
    files.delete(sessionId: "missing")
    queue.sync {}
    #expect(entries.withLock { $0 }.map(\.message) == ["Could not delete the abandoned session folder"])
  }
}
