import Testing
@testable import CaptureCoreLogic

struct CallListeningTests {
  @Test func hearsTheInterviewer() {
    #expect(CallListening.listens(to: "interviewer", isAudio: true, paused: false))
  }

  @Test func hearsNobodyDuringAPause() {
    #expect(!CallListening.listens(to: "interviewer", isAudio: true, paused: true))
  }

  @Test func neverHearsAnotherPhone() {
    #expect(!CallListening.listens(to: "iphone-VKOU", isAudio: true, paused: false))
    #expect(!CallListening.listens(to: "iphone", isAudio: true, paused: false))
  }

  @Test func takesNoVideo() {
    #expect(!CallListening.listens(to: "interviewer", isAudio: false, paused: false))
  }

  @Test func treatsANameStartingWithIphoneAsNoPhone() {
    #expect(CallListening.listens(to: "iphonedesk", isAudio: true, paused: false))
  }
}
