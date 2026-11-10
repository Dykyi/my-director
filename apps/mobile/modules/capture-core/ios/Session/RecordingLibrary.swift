import Foundation

@MainActor
final class RecordingLibrary {
  private let store: RecordingStore
  private let files: SessionFiles
  private let log: EventLog
  private(set) var recoveryReports: [RecoveryReport] = []

  nonisolated init(store: RecordingStore, files: SessionFiles, log: EventLog) {
    self.store = store
    self.files = files
    self.log = log
  }

  func list() async -> [RecordingSummary] {
    await scan().manifests.map { RecordingSummary($0, directory: store.directory(for: $0.id)) }
  }

  func acknowledgeRecovery(sessionId: String) throws {
    var recovered = try store.load(sessionId)
    recovered.acknowledgedAt = Date()
    try store.save(recovered)
    recoveryReports.removeAll { $0.sessionId == sessionId }
  }

  func verify(sessionId: String) async throws -> VerificationReport {
    let manifest = try store.load(sessionId)
    let report = await RecordingVerifier.verify(manifest, directory: store.directory(for: sessionId))
    files.save(report)
    return report
  }

  func delete(sessionId: String) throws {
    try store.delete(sessionId)
    recoveryReports.removeAll { $0.sessionId == sessionId }
  }

  func recoverUnfinished() async -> [RecoveryReport] {
    let scan = await scan()
    for name in scan.unreadable {
      log.error("recovery", "Unreadable session manifest", ["session": name])
    }
    for unfinished in scan.manifests where unfinished.isUnfinished {
      await recover(unfinished)
    }
    // A dialog missed on an earlier launch (dev launcher, JS reload) comes back until it is dismissed.
    for manifest in scan.manifests {
      if let pending = Recovery.pendingReport(manifest, directory: store.directory(for: manifest.id)) {
        recoveryReports.append(pending)
      }
    }
    return recoveryReports
  }

  private func recover(_ unfinished: SessionManifest) async {
    var inspections: [Int: SegmentInspection] = [:]
    for segment in unfinished.segments where segment.state == .writing {
      inspections[segment.index] = await RecoveryInspector.inspect(store.segmentURL(sessionId: unfinished.id, index: segment.index))
    }
    let (recovered, report) = Recovery.recover(unfinished, inspections: inspections, directory: store.directory(for: unfinished.id))
    files.save(recovered)
    recoveryReports.append(report)
    log.warning("recovery", "Unfinished recording found", [
      "sessionId": report.sessionId,
      "recoveredSec": report.recoveredSec.oneDecimal,
      "knownLossSec": report.knownLossSec.oneDecimal,
      "maxUnseenLossSec": report.maxUnseenLossSec.oneDecimal,
      "unplayable": String(report.segments.filter { $0.state == .unplayable }.count),
    ])
  }

  private func scan() async -> RecordingStore.ScanResult {
    let store = store
    return await Task.detached { store.scan() }.value
  }
}
