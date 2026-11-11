import Testing
@testable import CaptureCoreLogic

struct CallNameMemoryTests {
  @Test func keepsTheTokenNameWithoutARename() {
    #expect(CallNameMemory().nameToRestore(tokenName: "iphone") == nil)
  }

  @Test func restoresARenameTheTokenDoesNotCarry() {
    var memory = CallNameMemory()
    memory.remember("Studio phone")
    #expect(memory.nameToRestore(tokenName: "iphone") == "Studio phone")
  }

  @Test func leavesANameTheTokenAlreadyCarries() {
    var memory = CallNameMemory()
    memory.remember("Studio phone")
    #expect(memory.nameToRestore(tokenName: "Studio phone") == nil)
  }

  @Test func restoresTheLatestRename() {
    var memory = CallNameMemory()
    memory.remember("Studio phone")
    memory.remember("Desk phone")
    #expect(memory.nameToRestore(tokenName: "Studio phone") == "Desk phone")
  }
}
