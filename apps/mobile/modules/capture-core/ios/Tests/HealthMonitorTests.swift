import Testing
@testable import CaptureCoreLogic

struct HealthMonitorTests {
  private static let tick = 0.25
  private let health = CaptureConfig.defaults.health

  @Test func steadyBeatsProduceNoEdges() {
    var monitor = HealthMonitor(health: health)
    var edges: [HealthEdge] = []
    for step in 0..<40 {
      let now = Double(step) * Self.tick
      edges += monitor.evaluate(now: now, lastBeats: [.camera: now - 0.03], watchedSince: [.camera: 0])
    }
    #expect(edges.isEmpty)
  }

  @Test func gapLongerThanThresholdStallsOnceAndRecoversOnce() {
    var monitor = HealthMonitor(health: health)
    var edges: [HealthEdge] = []
    for step in 0..<40 {
      let now = Double(step) * Self.tick
      let lastBeat = now < 5 || now >= 7 ? now : 5
      edges += monitor.evaluate(now: now, lastBeats: [.camera: lastBeat], watchedSince: [.camera: 0])
    }
    #expect(edges == [HealthEdge(source: .camera, stalled: true), HealthEdge(source: .camera, stalled: false)])
  }

  @Test func unwatchedPipelinesAreSilent() {
    var monitor = HealthMonitor(health: health)
    #expect(monitor.evaluate(now: 100, lastBeats: [:], watchedSince: [:]).isEmpty)
  }

  @Test func beatsBeforeWatchingStartedDoNotCount() {
    var monitor = HealthMonitor(health: health)
    #expect(monitor.evaluate(now: 100.5, lastBeats: [.camera: 0], watchedSince: [.camera: 100]).isEmpty)
    #expect(monitor.evaluate(now: 101.5, lastBeats: [.camera: 0], watchedSince: [.camera: 100]).count == 1)
  }

  @Test func unwatchingDropsStallWithoutRecoveryEdge() {
    var monitor = HealthMonitor(health: health)
    _ = monitor.evaluate(now: 10, lastBeats: [:], watchedSince: [.microphone: 0])
    #expect(monitor.stalled == [.microphone])
    #expect(monitor.evaluate(now: 11, lastBeats: [:], watchedSince: [:]).isEmpty)
    #expect(monitor.evaluate(now: 12, lastBeats: [.microphone: 12], watchedSince: [.microphone: 12]).isEmpty)
  }

  @Test func eachPipelineUsesItsThreshold() {
    var monitor = HealthMonitor(health: health)
    let edges = monitor.evaluate(
      now: 11.1,
      lastBeats: [.camera: 10.5, .microphone: 10, .fileBytes: 10],
      watchedSince: [.camera: 0, .microphone: 0, .fileBytes: 0]
    )
    #expect(edges == [HealthEdge(source: .microphone, stalled: true)])
  }

  /// WebRTC stops the engine when a call ends and `MicrophoneSource` restarts it; the gap measured 1.1 to 1.3 s.
  @Test func micRestartIsNotAStallWithinTheGrace() {
    var monitor = HealthMonitor(health: health)
    var edges: [HealthEdge] = []
    for step in 0..<40 {
      let now = Double(step) * Self.tick
      let lastBeat = now < 5 || now >= 6.5 ? now : 4.9
      edges += monitor.evaluate(now: now, lastBeats: [.microphone: lastBeat], watchedSince: [.microphone: 0], restartedAt: [.microphone: 5])
    }
    #expect(edges.isEmpty)
  }

  /// The input goes quiet about 0.6 s before iOS reports the new route; a slow headset needs a while longer.
  @Test func bluetoothRouteSwitchIsNotAStall() {
    var monitor = HealthMonitor(health: health)
    var edges: [HealthEdge] = []
    for step in 0..<40 {
      let now = Double(step) * Self.tick
      let lastBeat = now < 5 || now >= 7.1 ? now : 4.9
      let routeChanged: [HeartbeatSource: Double] = now >= 5.6 ? [.microphone: 5.6] : [:]
      edges += monitor.evaluate(now: now, lastBeats: [.microphone: lastBeat], watchedSince: [.microphone: 0], restartedAt: routeChanged)
    }
    #expect(edges.isEmpty)
  }

  @Test func restartThatNeverDeliversStallsAfterTheGrace() {
    var monitor = HealthMonitor(health: health)
    let restart: [HeartbeatSource: Double] = [.microphone: 5]
    let grace = health.micRestartGraceMs / 1000
    #expect(monitor.evaluate(now: 5 + grace - 0.1, lastBeats: [.microphone: 4.9], watchedSince: [.microphone: 0], restartedAt: restart).isEmpty)
    #expect(monitor.evaluate(now: 5 + grace + 0.1, lastBeats: [.microphone: 4.9], watchedSince: [.microphone: 0], restartedAt: restart)
      == [HealthEdge(source: .microphone, stalled: true)])
  }

  @Test func beatAfterTheRestartEndsTheGrace() {
    var monitor = HealthMonitor(health: health)
    let restart: [HeartbeatSource: Double] = [.microphone: 5]
    #expect(monitor.evaluate(now: 6.4, lastBeats: [.microphone: 6.2], watchedSince: [.microphone: 0], restartedAt: restart).isEmpty)
    #expect(monitor.evaluate(now: 7.3, lastBeats: [.microphone: 6.2], watchedSince: [.microphone: 0], restartedAt: restart)
      == [HealthEdge(source: .microphone, stalled: true)])
  }

  @Test func restartCoversOnlyThePipelinesItNames() {
    var monitor = HealthMonitor(health: health)
    let edges = monitor.evaluate(
      now: 6.0,
      lastBeats: [.microphone: 4.9, .fileAudio: 4.9],
      watchedSince: [.microphone: 0, .fileAudio: 0],
      restartedAt: [.microphone: 5]
    )
    #expect(edges == [HealthEdge(source: .fileAudio, stalled: true)])
  }
}

struct RateMeterTests {
  @Test func measuresSteadyRate() {
    var meter = RateMeter()
    for frame in 0..<90 { meter.tick(at: Double(frame) / 30) }
    #expect(abs(meter.rate(at: 3) - 30) < 0.1)
  }

  @Test func silenceDropsRateToZero() {
    var meter = RateMeter()
    for frame in 0..<90 { meter.tick(at: Double(frame) / 30) }
    #expect(meter.rate(at: 6) == 0)
  }
}

struct SustainedConditionTests {
  @Test func reportsOnlySustainedConditions() {
    var condition = SustainedCondition(duration: 3)
    #expect(condition.update(true, at: 0) == nil)
    #expect(condition.update(true, at: 2.9) == nil)
    #expect(condition.update(true, at: 3) == .began)
    #expect(condition.update(true, at: 4) == nil)
    #expect(condition.update(false, at: 5) == .ended)
    #expect(condition.update(false, at: 6) == nil)
  }

  @Test func briefDipRestartsTheClock() {
    var condition = SustainedCondition(duration: 3)
    _ = condition.update(true, at: 0)
    _ = condition.update(false, at: 2)
    #expect(condition.update(true, at: 3) == nil)
    #expect(condition.update(true, at: 6) == .began)
  }
}

struct HealthWatchTests {
  private let beats: [HeartbeatSource: Double] = [.camera: 10.9, .microphone: 10.9, .fileVideo: 10.9, .fileAudio: 10.9, .fileBytes: 10.9]

  @Test func watchesEveryStreamOfTheOpenSegment() {
    var watch = HealthWatch(health: CaptureConfig.defaults.health)
    watch.watchSegment(openedAt: 10)
    var silentCamera = beats
    silentCamera[.camera] = nil
    #expect(watch.edges(now: 11.5, phase: .recording, lastBeats: silentCamera, restartedAt: [:]) == [HealthEdge(source: .camera, stalled: true)])
  }

  @Test func aClosedSegmentIsNotWatched() {
    var watch = HealthWatch(health: CaptureConfig.defaults.health)
    watch.watchSegment(openedAt: 10)
    watch.stopWatching()
    #expect(watch.edges(now: 20, phase: .recording, lastBeats: [:], restartedAt: [:]).isEmpty)
  }

  @Test func thresholdsReadInMilliseconds() {
    let watch = HealthWatch(health: CaptureConfig.defaults.health)
    #expect(watch.thresholdMs(for: .camera) == 1000)
    #expect(watch.thresholdMs(for: .fileBytes) == 5000)
  }

  @Test func aPauseRightAfterOpeningRaisesNoStall() {
    var watch = HealthWatch(health: CaptureConfig.defaults.health)
    watch.watchSegment(openedAt: 10)
    #expect(watch.edges(now: 15, phase: .paused, lastBeats: [:], restartedAt: [:]).isEmpty)
  }
}
