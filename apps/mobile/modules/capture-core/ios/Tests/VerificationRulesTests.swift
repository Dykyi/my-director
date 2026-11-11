import Foundation
import Testing
@testable import CaptureCoreLogic

struct VerificationRulesTests {
  private static let fps = 30.0
  private static let tailAllowanceSec = 0.6
  /// Three frames lost before the last one leave 133 ms, as in a file cut by a crash.
  private static let framesLostBeforeTheLast = [1_796, 1_797, 1_798]

  private func frameTimes(count: Int, rate: Double = 29.97, droppingAfter dropped: [Int] = []) -> [Double] {
    (0..<count).filter { !dropped.contains($0) }.map { Double($0) / rate }
  }

  private func facts(_ change: (inout SegmentFacts) -> Void = { _ in }) -> SegmentFacts {
    var facts = SegmentFacts(
      playable: true,
      videoCodec: "hvc1",
      displayWidth: 1080,
      displayHeight: 1920,
      frames: FrameTimeStats(times: frameTimes(count: 1_800), nominalFps: Self.fps),
      audioCodec: "aac",
      audioSampleRate: 48_000,
      audioChannels: 1,
      videoDurationSec: 60.06,
      audioDurationSec: 60.02,
      audioStartOffsetSec: 0.01,
      manifestDurationSec: 60.0
    )
    change(&facts)
    return facts
  }

  private func recovered(_ change: (inout SegmentFacts) -> Void = { _ in }) -> SegmentFacts {
    facts {
      $0.recoveredTailSec = Self.tailAllowanceSec
      change(&$0)
    }
  }

  private func frames(droppingAfter dropped: [Int]) -> FrameTimeStats {
    FrameTimeStats(times: frameTimes(count: 1_800, droppingAfter: dropped), nominalFps: Self.fps)
  }

  private func failed(_ facts: SegmentFacts) -> [String] {
    VerificationRules.evaluate(facts, nominalFps: Self.fps).filter { !$0.pass }.map(\.id)
  }

  private func check(_ id: String, of facts: SegmentFacts) throws -> VerificationCheck {
    try #require(VerificationRules.evaluate(facts, nominalFps: Self.fps).first { $0.id == id })
  }

  @Test func goodSegmentPassesEverything() {
    #expect(failed(facts()).isEmpty)
  }

  @Test func portraitSevenTwentyFailsResolution() {
    #expect(failed(facts { $0.displayWidth = 720; $0.displayHeight = 1280 }) == ["resolution"])
  }

  @Test func twentyFourFpsFails() {
    #expect(failed(facts { $0.frames = FrameTimeStats(times: frameTimes(count: 1_440, rate: 24), nominalFps: Self.fps) }).contains("fps"))
  }

  @Test func tooManyGapsFail() {
    let dropped = stride(from: 10, to: 1_800, by: 100).map { $0 }
    #expect(failed(facts { $0.frames = FrameTimeStats(times: frameTimes(count: 1_800, droppingAfter: dropped), nominalFps: Self.fps) }).contains("gaps"))
  }

  // At 29.97 fps two lost frames leave a 100.1 ms gap, shown as 100 ms against the 100 ms limit.
  @Test func twoLostFramesInARowPass() {
    let frames = FrameTimeStats(times: frameTimes(count: 1_800, droppingAfter: [500, 501]), nominalFps: Self.fps)
    #expect(!failed(facts { $0.frames = frames }).contains("gaps"))
  }

  @Test func threeLostFramesInARowFail() {
    let frames = FrameTimeStats(times: frameTimes(count: 1_800, droppingAfter: [500, 501, 502]), nominalFps: Self.fps)
    #expect(failed(facts { $0.frames = frames }).contains("gaps"))
  }

  @Test func singleLongGapFails() {
    let dropped = Array(500..<504)
    #expect(failed(facts { $0.frames = FrameTimeStats(times: frameTimes(count: 1_800, droppingAfter: dropped), nominalFps: Self.fps) }).contains("gaps"))
  }

  @Test func unreadFramesFailFpsAndGapsWithTheReason() {
    let checks = VerificationRules.evaluate(facts {
      $0.frames = FrameTimeStats(times: [], nominalFps: Self.fps)
      $0.frameReadError = "Operation Interrupted"
    }, nominalFps: Self.fps)
    let framed = checks.filter { ["fps", "gaps"].contains($0.id) }
    #expect(framed.count == 2)
    #expect(framed.allSatisfy { !$0.pass && $0.actual == "not read: Operation Interrupted" })
  }

  @Test func audioVideoDurationMismatchFails() {
    #expect(failed(facts { $0.audioDurationSec = 59.9 }) == ["durations"])
  }

  @Test func missingAudioFails() {
    #expect(failed(facts { $0.audioCodec = nil; $0.audioSampleRate = nil; $0.audioDurationSec = nil; $0.audioStartOffsetSec = nil })
      == ["audio", "durations", "audioStart"])
  }

  @Test func manifestMismatchFails() {
    #expect(failed(facts { $0.manifestDurationSec = 58 }) == ["manifestDuration"])
  }

  @Test func recoveredSegmentPassesTheCutLastFrameAsCrashTail() throws {
    let facts = recovered { $0.frames = frames(droppingAfter: Self.framesLostBeforeTheLast) }
    let gaps = try check("gaps", of: facts)
    #expect(gaps.pass && gaps.crashTail)
    #expect(gaps.actual == "0.06 %, longest 133 ms")
    #expect(gaps.note == "at the crash point: the app was closed here")
    #expect(failed(facts).isEmpty)
  }

  @Test func cutLastFrameFailsOutsideARecoveredSegment() throws {
    let facts = facts { $0.frames = frames(droppingAfter: Self.framesLostBeforeTheLast) }
    #expect(failed(facts) == ["gaps"])
    #expect(try !check("gaps", of: facts).crashTail)
  }

  @Test func gapInsideARecoveredSegmentFails() {
    #expect(failed(recovered { $0.frames = frames(droppingAfter: [900, 901, 902]) }) == ["gaps"])
  }

  @Test func recoveredSegmentPassesLateAudioWithinTheAllowanceAsCrashTail() throws {
    let facts = recovered { $0.videoDurationSec = 60.0; $0.audioDurationSec = 60.189 }
    let durations = try check("durations", of: facts)
    #expect(durations.pass && durations.crashTail)
    #expect(durations.actual == "189 ms")
    #expect(durations.note == "audio outlives the last frame after the crash")
    #expect(failed(facts).isEmpty)
  }

  @Test func shortAudioFailsInARecoveredSegment() {
    #expect(failed(recovered { $0.videoDurationSec = 60.189; $0.audioDurationSec = 60.0 }) == ["durations"])
  }

  @Test func lateAudioBeyondTheAllowanceFails() {
    #expect(failed(recovered { $0.videoDurationSec = 60.0; $0.audioDurationSec = 60.9 }) == ["durations"])
  }

  @Test func reportSavedBeforeCrashTailDecodes() throws {
    let check = #"{"actual":"189 ms","expected":"differ ≤ 100 ms","id":"durations","label":"Audio and video length","pass":false}"#
    let segment = #"{"checks":[\#(check)],"index":1,"pass":false,"uri":"segment-001.mov"}"#
    let json = #"{"pass":false,"segments":[\#(segment)],"sessionId":"s","verifiedAt":"2026-11-11T14:00:21.451Z"}"#
    let report = try JSONCoding.decoder().decode(VerificationReport.self, from: Data(json.utf8))
    let saved = try #require(report.segments.first?.checks.first)
    #expect(!saved.crashTail)
    #expect(saved.note == nil)
  }

  @Test func frameStatsMeasureRateAndGaps() {
    let stats = FrameTimeStats(times: frameTimes(count: 301, rate: 30, droppingAfter: [100, 101, 102]), nominalFps: Self.fps)
    #expect(abs(stats.fps - 29.7) < 0.05)
    #expect(stats.gapCount == 1)
    #expect(abs(stats.longestIntervalSec - 4.0 / 30) < 1e-9)
  }

  @Test func frameStatsIgnoreDecodeOrder() {
    let times = frameTimes(count: 301, rate: 30, droppingAfter: [100, 101, 102])
    // With B-frames a file lists a reference frame before the frame shown ahead of it.
    let decodeOrder = stride(from: 0, to: times.count - 1, by: 2).flatMap { [times[$0 + 1], times[$0]] }
    #expect(decodeOrder.count == times.count)
    #expect(FrameTimeStats(times: decodeOrder, nominalFps: Self.fps) == FrameTimeStats(times: times, nominalFps: Self.fps))
  }
}
