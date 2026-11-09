import Foundation
import Testing
@testable import BackgroundUploadLogic

struct UploadJobTests {
  private static let now = Date(timeIntervalSince1970: 1_800_000_000)
  private static let partSize: Int64 = 16_777_216
  private static let partCount = 29

  private func uploadingJob(maxAttempts: Int = 5) -> UploadJob {
    var job = UploadJob(
      id: "job-1",
      fileUri: "file:///segment-001.mov",
      objectKey: "s/segment-001.mov",
      api: UploadApi(baseUrl: "https://api", token: "t"),
      maxAttemptsPerPart: maxAttempts,
      bytesTotal: Self.partSize * Int64(Self.partCount),
      updatedAt: Self.now
    )
    let parts = (1...Self.partCount).map {
      UploadJob.Part(number: $0, size: Self.partSize, md5: "m", url: "https://part/\($0)", headers: ["Content-MD5": "m"])
    }
    _ = job.handle(.planned(uploadId: "upload-1", parts: parts), at: Self.now)
    return job
  }

  private func finish(_ job: inout UploadJob, part: Int, status: Int? = 200, etag: String? = "e") -> [UploadCommand] {
    job.handle(.partFinished(number: part, status: status, etag: etag, error: status == nil ? "offline" : nil), at: Self.now)
  }

  @Test func planningStartsEveryPartAtOnce() {
    let job = uploadingJob()
    #expect(job.phase == .uploading)
    #expect(job.parts.allSatisfy { $0.state == .inFlight })
  }

  @Test func failedPartSevenRetriesOnlyPartSeven() {
    var job = uploadingJob()
    let commands = finish(&job, part: 7, status: nil)
    #expect(commands == [.startPart(number: 7, delaySec: 2)])
    #expect(job.parts.filter { $0.state == .inFlight }.count == Self.partCount)
    #expect(job.retries.map(\.partNumber) == [7])
  }

  @Test func backoffGrowsAndIsCapped() {
    #expect(UploadJob.backoff(attempt: 1) == 2)
    #expect(UploadJob.backoff(attempt: 3) == 8)
    #expect(UploadJob.backoff(attempt: 10) == UploadJob.maxBackoffSec)
  }

  @Test func expiredUrlFailsWithoutRetry() {
    var job = uploadingJob()
    let commands = finish(&job, part: 3, status: 403)
    #expect(commands == [.cancelTasks, .finishFailed])
    #expect(job.phase == .failed)
    #expect(job.error?.contains("expired") == true)
    #expect(job.parts.first { $0.number == 3 }?.state == .failed)
    #expect(job.parts.filter { $0.state == .pending }.count == Self.partCount - 1)
  }

  @Test func attemptLimitFailsTheJob() {
    var job = uploadingJob(maxAttempts: 2)
    _ = finish(&job, part: 5, status: 503)
    _ = finish(&job, part: 5, status: 503)
    let commands = finish(&job, part: 5, status: 503)
    #expect(commands == [.cancelTasks, .finishFailed])
    #expect(job.phase == .failed)
  }

  @Test func badDigestChecksTheFileFirst() {
    var job = uploadingJob()
    #expect(finish(&job, part: 2, status: 400) == [.checkDigest(number: 2)])
    #expect(job.handle(.digestChecked(number: 2, matches: true), at: Self.now) == [.startPart(number: 2, delaySec: 2)])
  }

  @Test func changedFileFailsTheJob() {
    var job = uploadingJob()
    _ = finish(&job, part: 2, status: 400)
    #expect(job.handle(.digestChecked(number: 2, matches: false), at: Self.now) == [.cancelTasks, .finishFailed])
  }

  @Test func completeStartsOnlyAfterEveryPart() {
    var job = uploadingJob()
    for part in 1..<Self.partCount {
      #expect(finish(&job, part: part).isEmpty)
    }
    #expect(finish(&job, part: Self.partCount) == [.startComplete(delaySec: 0)])
    #expect(job.phase == .completing)
    #expect(job.completeRequest.parts.count == Self.partCount)
  }

  @Test func duplicateDeliveryIsIgnored() {
    var job = uploadingJob()
    _ = finish(&job, part: 1)
    let before = job
    #expect(finish(&job, part: 1).isEmpty)
    #expect(job.parts == before.parts)
  }

  @Test func verifiedOnlyWhenServerSizeMatches() {
    var job = uploadingJob()
    (1...Self.partCount).forEach { _ = finish(&job, part: $0) }
    let wrong = CompleteUploadResponse(verified: false, size: nil, expected: job.bytesTotal, actual: 10)
    #expect(job.handle(.completeFinished(status: 422, response: wrong, error: nil), at: Self.now) == [.cancelTasks, .finishFailed])

    var good = uploadingJob()
    (1...Self.partCount).forEach { _ = finish(&good, part: $0) }
    let right = CompleteUploadResponse(verified: true, size: good.bytesTotal, expected: nil, actual: nil)
    #expect(good.handle(.completeFinished(status: 200, response: right, error: nil), at: Self.now) == [.finishVerified])
    #expect(good.phase == .verified)
    #expect(good.serverSize == good.bytesTotal)
  }

  @Test func lostCompleteResponseIsRetried() {
    var job = uploadingJob()
    (1...Self.partCount).forEach { _ = finish(&job, part: $0) }
    #expect(job.handle(.completeFinished(status: nil, response: nil, error: "offline"), at: Self.now) == [.startComplete(delaySec: 2)])
  }

  @Test func reconcileRestartsOnlyOrphanedParts() {
    var job = uploadingJob()
    let live = Set((1...Self.partCount).filter { $0 != 4 && $0 != 9 })
    #expect(job.handle(.reconciled(livePartNumbers: live, completeIsLive: false), at: Self.now)
      == [.startPart(number: 4, delaySec: 0), .startPart(number: 9, delaySec: 0)])
  }

  @Test func retryFailedRestartsFailedAndPendingParts() {
    var job = uploadingJob()
    _ = finish(&job, part: 1)
    _ = finish(&job, part: 3, status: 403)
    let commands = job.handle(.retryFailedRequested, at: Self.now)
    #expect(job.phase == .uploading)
    #expect(commands.count == Self.partCount - 1)
    #expect(!commands.contains(.startPart(number: 1, delaySec: 0)))
  }

  @Test func cancelWhilePreparingIsFinal() {
    var job = UploadJob(
      id: "job-2",
      fileUri: "file:///segment-002.mov",
      objectKey: "s/segment-002.mov",
      api: UploadApi(baseUrl: "https://api", token: "t"),
      maxAttemptsPerPart: 5,
      bytesTotal: Self.partSize,
      updatedAt: Self.now
    )
    #expect(job.handle(.cancelRequested, at: Self.now) == [.cancelTasks])
    #expect(job.handle(.planned(uploadId: "late", parts: []), at: Self.now).isEmpty)
    #expect(job.handle(.preparationFailed("slicing stopped"), at: Self.now).isEmpty)
    #expect(job.phase == .cancelled)
    #expect(job.uploadId == nil)
  }
}
