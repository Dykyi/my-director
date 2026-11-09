import Testing
@testable import CaptureCoreLogic

struct AudioTimelineTests {
  private static let sampleRate = 48_000.0
  private static let framesPerBuffer = 480
  private static let bufferSec = 0.01
  private static let latency = 0.005
  private static let threshold = 0.040
  private static let tenMinutes = 60_000

  private struct Step {
    var observedStart: Double
    var placement: AudioTimeline.Placement
    var error: Double { placement.presentationTime - (observedStart + Double(placement.droppedFrames) / sampleRate) }
    var keptSec: Double { Double(framesPerBuffer - placement.droppedFrames) / sampleRate }
  }

  private func run(
    starts: [Double],
    offset: (Int) -> Double = { _ in 0 }
  ) -> (timeline: AudioTimeline, steps: [Step]) {
    var timeline = AudioTimeline(configuration: .init(
      sampleRate: Self.sampleRate, captureLatency: Self.latency, resyncThreshold: Self.threshold))
    let steps = starts.enumerated().map { index, start in
      let observed = start + offset(index)
      let arrival = observed + Self.bufferSec + Self.latency
      return Step(observedStart: observed, placement: timeline.place(frameCount: Self.framesPerBuffer, arrival: arrival))
    }
    return (timeline, steps)
  }

  private func steadyStarts(count: Int, bufferSec: Double = bufferSec) -> [Double] {
    (0..<count).map { 1_000 + Double($0) * bufferSec }
  }

  private func expectMonotonic(_ steps: [Step]) {
    for (previous, next) in zip(steps, steps.dropFirst()) {
      let previousEnd = previous.placement.presentationTime + previous.keptSec
      let nextStart = next.placement.presentationTime - Double(next.placement.silenceFrames) / Self.sampleRate
      #expect(nextStart >= previousEnd - 1e-9)
    }
  }

  @Test func steadyStreamIsContiguousForTenMinutes() {
    let (timeline, steps) = run(starts: steadyStarts(count: Self.tenMinutes))
    #expect(timeline.resyncCount == 0)
    for (previous, next) in zip(steps, steps.dropFirst()) {
      #expect(abs(next.placement.presentationTime - previous.placement.presentationTime - Self.bufferSec) < 1e-9)
    }
  }

  @Test func arrivalJitterDoesNotResync() {
    let jitterMs: [Double] = [0, 5, -5, 3, -3, 4, -4, 1]
    let (timeline, _) = run(starts: steadyStarts(count: Self.tenMinutes)) { jitterMs[$0 % jitterMs.count] / 1000 }
    #expect(timeline.resyncCount == 0)
  }

  @Test func ioBurstsOfFourBuffersDoNotResync() {
    let (timeline, _) = run(starts: steadyStarts(count: Self.tenMinutes)) { Double(3 - $0 % 4) * Self.bufferSec }
    #expect(timeline.resyncCount == 0)
  }

  private func startsLosing(buffers lost: Range<Int>) -> [Double] {
    steadyStarts(count: 3_000).enumerated().filter { !lost.contains($0.offset) }.map(\.element)
  }

  @Test func lostHundredMillisecondsInsertsSilenceOnce() throws {
    let (timeline, steps) = run(starts: startsLosing(buffers: 500..<510))
    #expect(timeline.resyncCount == 1)
    let corrected = try #require(steps.first { $0.placement.correction != nil })
    #expect(abs(try #require(corrected.placement.correction) - 0.1) < 0.01)
    #expect(abs(Double(corrected.placement.silenceFrames) - 4_800) <= 480)
    for step in steps.dropFirst(700) { #expect(abs(step.error) < 0.01) }
    expectMonotonic(steps)
  }

  @Test(arguments: [11, 13, 15, 30, 50])
  func lostAudioIsCorrectedInOneStep(lostBuffers: Int) throws {
    let (timeline, steps) = run(starts: startsLosing(buffers: 500..<(500 + lostBuffers)))
    #expect(timeline.resyncCount == 1)
    let correction = try #require(steps.compactMap(\.placement.correction).first)
    #expect(abs(correction - Double(lostBuffers) * Self.bufferSec) <= 0.01)
    expectMonotonic(steps)
  }

  @Test func singleLateBufferDoesNotResync() {
    let (timeline, _) = run(starts: steadyStarts(count: 2_000)) { $0 == 700 ? 1 : 0 }
    #expect(timeline.resyncCount == 0)
  }

  @Test func audioRunningAheadDropsFramesAcrossBuffers() {
    let (timeline, steps) = run(starts: steadyStarts(count: 3_000)) { $0 >= 500 ? -0.060 : 0 }
    #expect(timeline.resyncCount == 1)
    let dropped = steps.map(\.placement.droppedFrames).reduce(0, +)
    #expect(abs(Double(dropped) - 2_880) <= 288)
    for step in steps.dropFirst(700) { #expect(abs(step.error) < 0.01) }
    expectMonotonic(steps)
  }

  @Test func slowAudioClockStaysWithinThreshold() {
    let slowBufferSec = Self.bufferSec * (1 + 100e-6)
    let (timeline, steps) = run(starts: steadyStarts(count: Self.tenMinutes, bufferSec: slowBufferSec))
    #expect(timeline.resyncCount <= 2)
    #expect(steps.allSatisfy { abs($0.error) <= Self.threshold + 0.005 })
    expectMonotonic(steps)
  }
}
