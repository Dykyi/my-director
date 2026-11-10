import Testing
@testable import CaptureCoreLogic

struct AudioTailTests {
  @Test func padsTheTailWhereIOSTookTheMic() {
    #expect(AudioTail.silenceFrames(audioEnd: 37.555, videoEnd: 37.835, segmentStart: 0, sampleRate: 48_000) == 13_440)
  }

  @Test func leavesAudioThatCoversTheVideo() {
    #expect(AudioTail.silenceFrames(audioEnd: 10.02, videoEnd: 10, segmentStart: 0, sampleRate: 48_000) == 0)
  }

  @Test func neverInventsAudioForASegmentWithoutAny() {
    #expect(AudioTail.silenceFrames(audioEnd: 0, videoEnd: 30, segmentStart: 5, sampleRate: 48_000) == 0)
  }
}
