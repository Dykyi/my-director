import Foundation

enum Pipeline: String, CaseIterable, Sendable {
  case camera, microphone, fileVideo, fileAudio, fileBytes
}

struct HealthEdge: Equatable, Sendable {
  var pipeline: Pipeline
  var stalled: Bool
}

struct HealthMonitor: Sendable {
  private let health: CaptureConfig.Health
  private(set) var stalled: Set<Pipeline> = []

  init(health: CaptureConfig.Health) {
    self.health = health
  }

  mutating func evaluate(
    now: Double, lastBeats: [Pipeline: Double], watched: [Pipeline: Double], restartedAt: [Pipeline: Double] = [:]
  ) -> [HealthEdge] {
    stalled.formIntersection(watched.keys)
    return Pipeline.allCases.compactMap { pipeline in
      guard let watchedSince = watched[pipeline] else { return nil }
      let lastSign = max(lastBeats[pipeline] ?? watchedSince, watchedSince)
      let restart = restartedAt[pipeline].flatMap { $0 > lastSign ? $0 : nil }
      let isStalled = restart.map { now - $0 > health.micRestartGraceMs / 1000 } ?? (now - lastSign > threshold(for: pipeline))
      guard isStalled != stalled.contains(pipeline) else { return nil }
      if isStalled { stalled.insert(pipeline) } else { stalled.remove(pipeline) }
      return HealthEdge(pipeline: pipeline, stalled: isStalled)
    }
  }

  func threshold(for pipeline: Pipeline) -> Double {
    switch pipeline {
    case .camera, .fileVideo: health.videoStallMs / 1000
    case .microphone, .fileAudio: health.audioStallMs / 1000
    case .fileBytes: health.fileStallMs / 1000
    }
  }
}
