import Testing
@testable import CaptureCoreLogic

struct DiskSpacePolicyTests {
  private static let mebibyte: Int64 = 1_048_576
  private let policy = DiskSpacePolicy(.defaults)

  @Test func startNeedsTheConfiguredFreeSpace() {
    #expect(policy.failureToStart(freeBytes: 2048 * Self.mebibyte) == nil)
    #expect(policy.failureToStart(freeBytes: 2047 * Self.mebibyte)
      == Failure(code: .diskFull, message: "Need 2048 MB free to start, 2047 MB available"))
  }

  @Test func recordingPausesBelowTheCriticalLevel() {
    #expect(policy.reaction(freeBytes: 200 * Self.mebibyte, isRecording: true)
      == .pause(Failure(code: .diskFull, message: "Only 200 MB left"), .diskFull))
  }

  @Test func lowSpaceWarnsWithTheMinutesLeft() {
    #expect(policy.reaction(freeBytes: 500 * Self.mebibyte, isRecording: true) == .warn(.diskSpaceLow, "500 MB left, about 11 min of recording"))
    #expect(policy.reaction(freeBytes: 200 * Self.mebibyte, isRecording: false) == .warn(.diskSpaceLow, "200 MB left, about 4 min of recording"))
  }

  @Test func enoughSpaceClearsTheWarning() {
    #expect(policy.reaction(freeBytes: 2000 * Self.mebibyte, isRecording: true) == .clearWarning(.diskSpaceLow))
  }
}

struct HealthReactionTests {
  private func reaction(_ source: HeartbeatSource, stalled: Bool = true, thresholdMs: Int = 1000) -> HealthReaction? {
    HealthEdge(source: source, stalled: stalled).reaction(thresholdMs: thresholdMs)
  }

  @Test func streamStallsPauseWithTheirReason() {
    #expect(reaction(.camera) == .pause(Failure(code: .cameraStalled, message: "No camera frames for 1000 ms"), .cameraStalled))
    #expect(reaction(.microphone) == .pause(Failure(code: .audioStalled, message: "No microphone audio for 1000 ms"), .micStalled))
    #expect(reaction(.fileVideo) == .pause(Failure(code: .fileStalled, message: "Frames stopped reaching the file for 1000 ms"), .fileError))
    #expect(reaction(.fileBytes, thresholdMs: 5000)
      == .pause(Failure(code: .fileStalled, message: "The file has not grown for 5000 ms"), .fileError))
  }

  @Test func fileAudioOnlyWarns() {
    #expect(reaction(.fileAudio) == .warn(.audioStalled, "Audio stopped reaching the file"))
    #expect(reaction(.fileAudio, stalled: false) == .clearWarning(.audioStalled))
  }

  @Test func otherRecoveriesNeedNothing() {
    #expect(reaction(.camera, stalled: false) == nil)
    #expect(reaction(.fileBytes, stalled: false) == nil)
  }
}

struct FileRateWatchTests {
  private func run(_ samples: [(fps: Double, segmentSec: Double, at: Double)]) -> [HealthReaction?] {
    var watch = FileRateWatch(targetFps: 30)
    return samples.map { watch.update(fps: $0.fps, segmentSec: $0.segmentSec, at: $0.at) }
  }

  @Test func warmUpHidesASlowStart() {
    #expect(run((0...6).map { (10, 3, Double($0)) }).allSatisfy { $0 == nil })
  }

  @Test func warnsOnceAfterTheRateStaysLow() {
    let reactions = run([(20, 4, 10), (20, 6, 12), (20, 7, 13), (20, 8, 14), (30, 9, 15)])
    #expect(reactions == [nil, nil, .warn(.fileFpsLow, "File is recording at 20.0 fps"), nil, .clearWarning(.fileFpsLow)])
  }

  @Test func halfAFrameBelowTargetIsFine() {
    #expect(run((4...10).map { (29.6, Double($0), Double($0)) }).allSatisfy { $0 == nil })
  }
}

struct IntervalGateTests {
  @Test func opensOncePerInterval() {
    var gate = IntervalGate(every: 1)
    let opened = [100, 100.5, 101].map { gate.opens(at: $0) }
    #expect(opened == [true, false, true])
  }

  @Test func aGateStartingAtMinusInfinityOpensAtOnce() {
    var gate = IntervalGate(every: 10, startingAt: -.infinity)
    let opened = [0, 5].map { gate.opens(at: $0) }
    #expect(opened == [true, false])
  }
}
