import Testing
@testable import BackgroundUploadLogic

struct TaskTagTests {
  @Test func partTagRoundTrips() {
    let tag = TaskTag(jobId: "9C1E-job", kind: .part(number: 7, attempt: 2))
    #expect(tag.taskDescription == "9C1E-job|part|7|2")
    #expect(TaskTag(tag.taskDescription) == tag)
    #expect(tag.partNumber == 7)
  }

  @Test func completeTagRoundTrips() {
    let tag = TaskTag(jobId: "9C1E-job", kind: .complete(attempt: 1))
    #expect(tag.taskDescription == "9C1E-job|complete|1")
    #expect(TaskTag(tag.taskDescription) == tag)
    #expect(tag.partNumber == nil)
  }

  @Test func foreignDescriptionsAreIgnored() {
    #expect(TaskTag(nil) == nil)
    #expect(TaskTag("") == nil)
    #expect(TaskTag("job|part|x|1") == nil)
    #expect(TaskTag("job|unknown|1") == nil)
  }
}
