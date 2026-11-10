struct HealthWatch: Sendable {
  private var monitor: HealthMonitor
  private var watchedSince: [HeartbeatSource: Double] = [:]

  init(health: CaptureConfig.Health) {
    monitor = HealthMonitor(health: health)
  }

  mutating func watchSegment(openedAt now: Double) {
    watchedSince = Dictionary(uniqueKeysWithValues: HeartbeatSource.allCases.map { ($0, now) })
  }

  mutating func stopWatching() {
    watchedSince = [:]
  }

  func thresholdMs(for source: HeartbeatSource) -> Int {
    Int(monitor.threshold(for: source) * 1000)
  }

  /// Only a recording session is watched: a pause can land before the segment that just opened is watched.
  mutating func edges(
    now: Double, phase: SessionPhase, lastBeats: [HeartbeatSource: Double], restartedAt: [HeartbeatSource: Double]
  ) -> [HealthEdge] {
    let watched = phase == .recording ? watchedSince : [:]
    return monitor.evaluate(now: now, lastBeats: lastBeats, watchedSince: watched, restartedAt: restartedAt)
  }
}
