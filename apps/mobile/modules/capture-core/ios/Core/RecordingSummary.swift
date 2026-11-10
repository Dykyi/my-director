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
