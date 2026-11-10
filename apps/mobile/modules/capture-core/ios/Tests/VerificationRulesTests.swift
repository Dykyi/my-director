import Testing
@testable import CaptureCoreLogic

struct VerificationRulesTests {
  private static let fps = 30.0

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

  private func failed(_ facts: SegmentFacts) -> [String] {
    VerificationRules.evaluate(facts, nominalFps: Self.fps).filter { !$0.pass }.map(\.id)
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

  @Test func singleLongGapFails() {
    let dropped = Array(500..<504)
    #expect(failed(facts { $0.frames = FrameTimeStats(times: frameTimes(count: 1_800, droppingAfter: dropped), nominalFps: Self.fps) }).contains("gaps"))
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
