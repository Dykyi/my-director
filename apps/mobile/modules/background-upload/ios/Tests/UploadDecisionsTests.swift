import Foundation
import Testing
@testable import BackgroundUploadLogic

struct UploadDecisionsTests {
  private func job(parts: [UploadJob.Part] = []) -> UploadJob {
    var job = UploadJob(
      id: "job-1",
      fileUri: "file:///segment-001.mov",
      objectKey: "s/segment-001.mov",
      api: UploadApi(baseUrl: "https://api", token: "t"),
      maxAttemptsPerPart: 5,
      bytesTotal: 482_344_960,
      updatedAt: .now
    )
    job.parts = parts
    return job
  }

  private func part(_ number: Int, attempt: Int = 0) -> UploadJob.Part {
    var part = UploadJob.Part(number: number, size: 16, md5: "m\(number)", url: "https://part/\(number)", headers: [:])
    part.attempt = attempt
    return part
  }

  @Test func onlyTheCurrentAttemptCounts() {
    var job = job(parts: [part(1, attempt: 2)])
    job.completeAttempt = 1
    #expect(job.isCurrent(TaskTag(jobId: "job-1", kind: .part(number: 1, attempt: 2))))
    #expect(!job.isCurrent(TaskTag(jobId: "job-1", kind: .part(number: 1, attempt: 1))))
    #expect(!job.isCurrent(TaskTag(jobId: "job-1", kind: .part(number: 9, attempt: 0))))
    #expect(job.isCurrent(TaskTag(jobId: "job-1", kind: .complete(attempt: 1))))
    #expect(!job.isCurrent(TaskTag(jobId: "job-1", kind: .complete(attempt: 0))))
  }

  @Test func slicedPartsJoinTheSignedUrls() throws {
    let sliced = [1, 2].map { SlicedPart(number: $0, url: URL(filePath: "/p\($0)"), size: 16, md5Base64: "m\($0)") }
    let signed = [1, 2].map { CreateUploadResponse.Part(partNumber: $0, url: "https://signed/\($0)", headers: ["Content-MD5": "m\($0)"]) }
    let parts = try UploadJob.Part.planned(sliced: sliced, signed: signed)
    #expect(parts.map(\.url) == ["https://signed/1", "https://signed/2"])
    #expect(parts.map(\.md5) == ["m1", "m2"])
    #expect(throws: UploadEngineError.planMismatch) {
      try UploadJob.Part.planned(sliced: sliced, signed: Array(signed.prefix(1)))
    }
  }

  @Test func theVerifiedNoticeSaysSizePartsAndKey() {
    #expect(job(parts: (1...29).map { part($0) }).verifiedSummary == "460.0 MB · 29 parts · s/segment-001.mov")
  }

  @Test func errorsReadInMegabytes() {
    #expect(UploadEngineError.notEnoughSpace(neededBytes: 600 * bytesPerMebibyte, freeBytes: 120 * bytesPerMebibyte)
      .localizedDescription == "Not enough free space: need 600 MB, have 120 MB")
    #expect(UploadPlanError.partTooSmall(minimum: 5 * bytesPerMebibyte).localizedDescription == "Parts must be at least 5 MiB")
  }
}
