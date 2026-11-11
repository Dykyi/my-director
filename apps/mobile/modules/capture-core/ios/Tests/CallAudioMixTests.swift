import Testing
@testable import CaptureCoreLogic

/// At 1 kHz one frame is one millisecond, which keeps the times readable.
struct CallAudioMixTests {
  private static let sampleRate = 1_000.0

  private func makeMix(gainDb: Double = 0) -> CallAudioMix {
    CallAudioMix(sampleRate: Self.sampleRate, resyncThreshold: 0.04, gainDb: gainDb)
  }

  private func add(_ samples: [Int16], playsAt: Double, to mix: inout CallAudioMix) {
    _ = samples.withUnsafeBufferPointer { mix.add($0, playsAt: playsAt) }
  }

  private func mixIn(_ mic: [Int16], at time: Double, with mix: inout CallAudioMix) -> [Int16] {
    mic.withUnsafeBufferPointer { mix.mix($0, at: time) }
  }

  @Test func addsTheCallOverTheSameStretchOfTime() {
    var mix = makeMix()
    add([100, 100, 100, 100], playsAt: 10.000, to: &mix)
    #expect(mixIn([1, 1, 1, 1, 1, 1], at: 9.998, with: &mix) == [1, 1, 101, 101, 101, 101])
    #expect(mix.summary.mixedSec == 0.004)
  }

  @Test func turnsTheCallDownByItsGain() {
    var mix = makeMix(gainDb: -6)
    add([100, 100], playsAt: 10.000, to: &mix)
    #expect(mixIn([0, 0], at: 10.000, with: &mix) == [50, 50])
  }

  @Test func placesTwoChunksStampedAlikeOneAfterTheOther() {
    var mix = makeMix()
    add(Array(repeating: 1, count: 10), playsAt: 10.000, to: &mix)
    add(Array(repeating: 2, count: 10), playsAt: 10.000, to: &mix)
    let expected = Array(repeating: Int16(1), count: 10) + Array(repeating: 2, count: 10)
    #expect(mixIn(Array(repeating: 0, count: 20), at: 10.000, with: &mix) == expected)
  }

  private func addChunks(_ value: Int16, count: Int, from start: Double, to mix: inout CallAudioMix) {
    for index in 0..<count {
      add(Array(repeating: value, count: 10), playsAt: start + Double(index) / 100, to: &mix)
    }
  }

  @Test func startsTheCallClockAgainAfterAPauseInThePlayout() {
    var mix = makeMix()
    addChunks(1, count: 10, from: 10.00, to: &mix)
    addChunks(2, count: 3, from: 11.10, to: &mix)
    #expect(mixIn(Array(repeating: 0, count: 30), at: 11.10, with: &mix) == Array(repeating: 2, count: 30))
    #expect(mix.summary.resyncCount == 1)
  }

  @Test func followsTheCallBackWhenItPlaysSooner() {
    var mix = makeMix()
    addChunks(1, count: 10, from: 10.00, to: &mix)
    addChunks(2, count: 3, from: 9.95, to: &mix)
    #expect(mixIn(Array(repeating: 0, count: 30), at: 9.95, with: &mix) == Array(repeating: 2, count: 30))
  }

  @Test func countsCallAudioThatCameAfterTheMicrophoneWasWritten() {
    var mix = makeMix()
    _ = mixIn([0, 0, 0, 0], at: 10.000, with: &mix)
    add([100, 100, 100, 100], playsAt: 10.002, to: &mix)
    #expect(mix.summary.lateSec == 0.002)
  }

  @Test func leavesTheMicrophoneAloneWithoutACall() {
    var mix = makeMix()
    #expect(mixIn([5, -7, 9], at: 10.000, with: &mix) == [5, -7, 9])
    #expect(!mix.hasAudio)
    #expect(mix.summary == .init(mixedSec: 0, lateSec: 0, clippedSamples: 0, resyncCount: 0))
  }

  @Test func skipsAudioWithoutAValidTime() {
    var mix = makeMix()
    add([100, 100], playsAt: .nan, to: &mix)
    #expect(!mix.hasAudio)
    add([100, 100], playsAt: 10.000, to: &mix)
    #expect(mixIn([1, 1], at: .infinity, with: &mix) == [1, 1])
  }

  @Test func countsSamplesHeldAtTheEdge() {
    var mix = makeMix()
    add([2_000], playsAt: 10.000, to: &mix)
    #expect(mixIn([32_000], at: 10.000, with: &mix) == [.max])
    #expect(mix.summary.clippedSamples == 1)
  }
}
