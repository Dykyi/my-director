import Testing
@testable import CaptureCoreLogic

/// At 1 kHz one frame is one millisecond, which keeps the times readable.
struct CallAudioRingTests {
  private static let sampleRate = 1_000.0

  private func makeRing(capacitySec: Double = 1) -> CallAudioRing {
    CallAudioRing(sampleRate: Self.sampleRate, capacitySec: capacitySec)
  }

  private func write(_ samples: [Int16], at time: Double, into ring: inout CallAudioRing) {
    samples.withUnsafeBufferPointer { ring.write($0, at: time) }
  }

  @Test func readsWhatWasWrittenAtTheSameTime() {
    var ring = makeRing()
    write([1, 2, 3, 4], at: 10.000, into: &ring)
    #expect(ring.read(from: 10.001, count: 2) == .init(samples: [2, 3], covered: 2))
  }

  @Test func readsSilenceBeforeAnythingWasWritten() {
    #expect(makeRing().read(from: 10, count: 3) == .init(samples: [0, 0, 0], covered: 0))
  }

  @Test func readsSilenceAroundTheWrittenAudio() {
    var ring = makeRing()
    write([1, 2], at: 10.000, into: &ring)
    #expect(ring.read(from: 9.998, count: 6) == .init(samples: [0, 0, 1, 2, 0, 0], covered: 2))
  }

  @Test func keepsAGapBetweenWritesSilent() {
    var ring = makeRing(capacitySec: 0.004)
    write([7, 7, 7, 7], at: 9.996, into: &ring)
    write([1, 1], at: 10.000, into: &ring)
    write([2, 2], at: 10.004, into: &ring)
    #expect(ring.read(from: 10.002, count: 4) == .init(samples: [0, 0, 2, 2], covered: 4))
  }

  @Test func forgetsAudioOlderThanItsCapacity() {
    var ring = makeRing(capacitySec: 0.004)
    write([1, 2, 3, 4], at: 10.000, into: &ring)
    write([5, 6], at: 10.004, into: &ring)
    #expect(ring.read(from: 10.000, count: 6) == .init(samples: [0, 0, 3, 4, 5, 6], covered: 4))
  }

  @Test func ignoresAWriteOlderThanItsCapacity() {
    var ring = makeRing(capacitySec: 0.004)
    write([1, 2, 3, 4, 5, 6], at: 10.000, into: &ring)
    write([9, 9], at: 10.000, into: &ring)
    #expect(ring.read(from: 10.002, count: 4) == .init(samples: [3, 4, 5, 6], covered: 4))
  }

  @Test func endsWhereTheWrittenAudioEnds() {
    var ring = makeRing()
    #expect(ring.endTime == nil)
    write([1, 2, 3], at: 10.000, into: &ring)
    #expect(ring.endTime == 10.003)
  }
}
