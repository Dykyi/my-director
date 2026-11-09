import Foundation

enum SegmentOutcome: Equatable, Sendable {
  case empty
  case finalized(durationSec: Double, bytes: Int64)
  case failed(message: String)
}

struct SegmentInspection: Equatable, Sendable {
  var playable: Bool
  var durationSec: Double
  var bytes: Int64
  var failureReason: String?
}

struct SessionManifest: Codable, Equatable, Sendable {
  static let currentSchemaVersion = 1

  enum State: String, Codable, Sendable { case recording, paused, finished, recovered }

  struct Device: Codable, Equatable, Sendable {
    var model: String
    var os: String
    var app: String
  }

  struct Segment: Codable, Equatable, Sendable {
    enum State: String, Codable, Sendable { case writing, finalized, recovered, unplayable }

    var index: Int
    var file: String
    var state: State
    var startedAt: Date
    var endedAt: Date?
    var durationSec: Double?
    var bytes: Int64?
    var pauseReason: PauseReason?
    var failure: String?

    static func fileName(for index: Int) -> String {
      String(format: "segment-%03d.mov", index)
    }
  }

  var schemaVersion = SessionManifest.currentSchemaVersion
  var id: String
  var createdAt: Date
  var room: String?
  var state: State
  var config: CaptureConfig
  var device: Device
  var segments: [Segment] = []
  var heartbeatAt: Date?
  var lastVideoSec: Double?
  var acknowledgedAt: Date?

  var recordedSec: Double { segments.compactMap(\.durationSec).reduce(0, +) }
  var totalBytes: Int64 { segments.compactMap(\.bytes).reduce(0, +) }
  var isUnfinished: Bool { state == .recording || state == .paused }

  mutating func openSegment(index: Int, at date: Date) {
    segments.append(Segment(index: index, file: Segment.fileName(for: index), state: .writing, startedAt: date))
    state = .recording
    lastVideoSec = 0
    heartbeatAt = date
  }

  mutating func closeSegment(index: Int, outcome: SegmentOutcome, pauseReason: PauseReason?, at date: Date) {
    state = .paused
    lastVideoSec = nil
    guard let position = segments.firstIndex(where: { $0.index == index }) else { return }
    switch outcome {
    case .empty:
      segments.remove(at: position)
      return
    case .finalized(let durationSec, let bytes):
      segments[position].state = .finalized
      segments[position].durationSec = durationSec
      segments[position].bytes = bytes
    case .failed(let message):
      segments[position].failure = message
    }
    segments[position].endedAt = date
    segments[position].pauseReason = pauseReason
  }

  mutating func applyInspection(_ inspection: SegmentInspection, toSegment index: Int) {
    guard let position = segments.firstIndex(where: { $0.index == index }) else { return }
    segments[position].state = inspection.playable ? .recovered : .unplayable
    segments[position].durationSec = inspection.durationSec
    segments[position].bytes = inspection.bytes
    if let reason = inspection.failureReason { segments[position].failure = reason }
  }

  mutating func recordHeartbeat(lastVideoSec: Double, at date: Date) {
    self.lastVideoSec = lastVideoSec
    heartbeatAt = date
  }

  mutating func finish() {
    state = .finished
    lastVideoSec = nil
  }
}
