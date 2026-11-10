import Testing
@testable import BackgroundUploadLogic

struct UploadPlanTests {
  private static let mebibyte: Int64 = 1_048_576

  @Test func fourHundredSixtyMegabytesMakeTwentyNineParts() throws {
    let plan = try UploadPlan(fileSize: 482_344_960, partSize: 16 * Self.mebibyte)
    #expect(plan.partCount == 29)
    #expect((1...28).allSatisfy { plan.size(ofPart: $0) == 16 * Self.mebibyte })
    #expect(plan.size(ofPart: 29) == 12_582_912)
    #expect(plan.offset(ofPart: 29) == 28 * 16 * Self.mebibyte)
  }

  @Test func exactMultipleHasFullLastPart() throws {
    let plan = try UploadPlan(fileSize: 32 * Self.mebibyte, partSize: 16 * Self.mebibyte)
    #expect(plan.partCount == 2)
    #expect(plan.size(ofPart: 2) == 16 * Self.mebibyte)
  }

  @Test func smallFileIsOnePart() throws {
    let plan = try UploadPlan(fileSize: 1_000, partSize: 16 * Self.mebibyte)
    #expect(plan.partCount == 1)
    #expect(plan.size(ofPart: 1) == 1_000)
  }

  @Test func partsBelowFiveMebibytesAreRejected() {
    #expect(throws: UploadPlanError.partTooSmall(minimum: UploadPlan.minimumPartSize)) {
      try UploadPlan(fileSize: 100 * Self.mebibyte, partSize: 4 * Self.mebibyte)
    }
  }

  @Test func moreThanTenThousandPartsAreRejected() {
    #expect(throws: UploadPlanError.tooManyParts(count: 10_001, maximum: 10_000)) {
      try UploadPlan(fileSize: UploadPlan.minimumPartSize * 10_001, partSize: UploadPlan.minimumPartSize)
    }
  }
}
