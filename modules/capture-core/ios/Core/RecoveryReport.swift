import Foundation

struct SegmentSummary: Codable, Equatable, Sendable {
  var index: Int
  var uri: String
  var state: SessionManifest.Segment.State
  var durationSec: Double
  var bytes: Int64
  var pauseReason: PauseReason?
  var failure: String?

  init(_ segment: SessionManifest.Segment, directory: URL) {
    index = segment.index
    uri = directory.appending(path: segment.file).absoluteString
    state = segment.state
    durationSec = segment.durationSec ?? 0
    bytes = segment.bytes ?? 0
    pauseReason = segment.pauseReason
    failure = segment.failure
  }
}

struct RecordingSummary: Codable, Equatable, Sendable {
  var sessionId: String
  var createdAt: Date
  var state: SessionManifest.State
  var room: String?
  var segments: [SegmentSummary]
  var totalSec: Double
  var totalBytes: Int64

  init(_ manifest: SessionManifest, directory: URL) {
    sessionId = manifest.id
    createdAt = manifest.createdAt
    state = manifest.state
    room = manifest.room
    segments = manifest.segments.map { SegmentSummary($0, directory: directory) }
    totalSec = manifest.recordedSec
    totalBytes = manifest.totalBytes
  }
}

struct RecoveryReport: Codable, Equatable, Sendable {
  var sessionId: String
  var createdAt: Date
  var segments: [SegmentSummary]
  var recoveredSec: Double
  var knownLossSec: Double
  var maxUnseenLossSec: Double
  var lastHeartbeatAt: Date?
}

struct RecoveryLoss: Codable, Equatable, Sendable {
  var knownLossSec: Double
  var maxUnseenLossSec: Double
}

enum Recovery {
  static func recover(
    _ manifest: SessionManifest,
    inspections: [Int: SegmentInspection],
    directory: URL
  ) -> (manifest: SessionManifest, report: RecoveryReport) {
    var recovered = manifest
    var knownLossSec = 0.0
    var maxUnseenLossSec = 0.0
    let openSegmentIndex = manifest.lastVideoSec == nil ? nil : manifest.segments.last?.index
    for segment in manifest.segments where segment.state == .writing {
      guard let inspection = inspections[segment.index] else { continue }
      recovered.applyInspection(inspection, toSegment: segment.index)
      if segment.index == openSegmentIndex, let lastVideoSec = manifest.lastVideoSec {
        knownLossSec = max(0, lastVideoSec - inspection.durationSec)
        maxUnseenLossSec = manifest.config.session.heartbeatIntervalSec
      }
    }
    recovered.state = .recovered
    recovered.lastVideoSec = nil
    let loss = RecoveryLoss(knownLossSec: knownLossSec, maxUnseenLossSec: maxUnseenLossSec)
    recovered.recoveryLoss = loss
    return (recovered, report(recovered, loss: loss, directory: directory))
  }

  static func pendingReport(_ manifest: SessionManifest, directory: URL) -> RecoveryReport? {
    guard manifest.state == .recovered, manifest.acknowledgedAt == nil, let loss = manifest.recoveryLoss else { return nil }
    return report(manifest, loss: loss, directory: directory)
  }

  private static func report(_ manifest: SessionManifest, loss: RecoveryLoss, directory: URL) -> RecoveryReport {
    RecoveryReport(
      sessionId: manifest.id,
      createdAt: manifest.createdAt,
      segments: manifest.segments.map { SegmentSummary($0, directory: directory) },
      recoveredSec: manifest.recordedSec,
      knownLossSec: loss.knownLossSec,
      maxUnseenLossSec: loss.maxUnseenLossSec,
      lastHeartbeatAt: manifest.heartbeatAt
    )
  }
}
