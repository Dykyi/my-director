import Foundation

enum HeartbeatSource: String, CaseIterable, Sendable {
  case camera, microphone, fileVideo, fileAudio, fileBytes
}

struct HealthEdge: Equatable, Sendable {
  var source: HeartbeatSource
  var stalled: Bool
}

struct HealthMonitor: Sendable {
  private let health: CaptureConfig.Health
  private(set) var stalled: Set<HeartbeatSource> = []

  init(health: CaptureConfig.Health) {
    self.health = health
  }

  /// Until the first beat after a restart, silence counts from the restart against `micRestartGraceMs`
  /// instead of the stall threshold.
  mutating func evaluate(
    now: Double, lastBeats: [HeartbeatSource: Double], watchedSince: [HeartbeatSource: Double], restartedAt: [HeartbeatSource: Double] = [:]
  ) -> [HealthEdge] {
    stalled.formIntersection(watchedSince.keys)
    return HeartbeatSource.allCases.compactMap { source in
      guard let since = watchedSince[source] else { return nil }
      let lastSign = max(lastBeats[source] ?? since, since)
      let restart = restartedAt[source].flatMap { $0 > lastSign ? $0 : nil }
      let isStalled = restart.map { now - $0 > health.micRestartGraceSec } ?? (now - lastSign > threshold(for: source))
      guard isStalled != stalled.contains(source) else { return nil }
      if isStalled { stalled.insert(source) } else { stalled.remove(source) }
      return HealthEdge(source: source, stalled: isStalled)
    }
  }

  func threshold(for source: HeartbeatSource) -> Double {
    switch source {
    case .camera, .fileVideo: health.videoStallSec
    case .microphone, .fileAudio: health.audioStallSec
    case .fileBytes: health.fileStallSec
    }
  }
}
