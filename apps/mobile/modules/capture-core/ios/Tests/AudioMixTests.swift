import Testing
@testable import CaptureCoreLogic

struct AudioMixTests {
  private func mix(_ mic: [Int16], _ call: [Int16], gainDb: Double = 0) -> AudioMix.Result {
    mic.withUnsafeBufferPointer { AudioMix.mix($0, call, gain: AudioMix.gain(db: gainDb)) }
  }

  @Test func addsTheCallToTheMicrophone() {
    #expect(mix([100, -200, 0], [10, 20, -30]) == .init(samples: [110, -180, -30], clipped: 0))
  }

  @Test func turnsTheCallDownBySixDecibelsToHalf() {
    #expect(mix([0, 0], [100, -100], gainDb: -6).samples == [50, -50])
  }

  @Test func holdsTheSumAtTheEdgesAndCountsIt() {
    #expect(mix([32_000, -32_000, 1], [2_000, -2_000, 1]) == .init(samples: [.max, .min, 2], clipped: 2))
  }

  @Test func leavesTheMicrophoneAloneWhenTheCallIsSilent() {
    #expect(mix([5, -7, 9], [0, 0, 0]) == .init(samples: [5, -7, 9], clipped: 0))
  }
}
