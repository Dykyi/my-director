import Foundation

struct SessionFiles: Sendable {
  let store: RecordingStore
  let log: EventLog
  let queue: DispatchQueue

  func save(_ manifest: SessionManifest) {
    write("session", "Manifest write failed") { [store] in try store.save(manifest) }
  }

  func save(_ report: VerificationReport) {
    let url = store.verificationURL(sessionId: report.sessionId)
    write("verify", "Verification report write failed") { try RecordingStore.write(JSONCoding.encoder().encode(report), to: url) }
  }

  func delete(sessionId: String) {
    write("session", "Could not delete the abandoned session folder", level: .warning) { [store] in try store.delete(sessionId) }
  }

  private func write(_ category: String, _ failure: String, level: LogLevel = .error, _ work: @escaping @Sendable () throws -> Void) {
    queue.async { [log] in
      do {
        try work()
      } catch {
        log.log(level, category, failure, ["error": error.localizedDescription])
      }
    }
  }
}
