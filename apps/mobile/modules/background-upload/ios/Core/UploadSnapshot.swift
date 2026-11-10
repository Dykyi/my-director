import Foundation

/// What JS sees of a job: no presigned URLs and no API token.
struct UploadSnapshot: Codable, Equatable, Sendable {
  var id: String
  var fileUri: String
  var objectKey: String
  var uploadId: String?
  var phase: UploadJob.Phase
  var bytesTotal: Int64
  var bytesConfirmed: Int64
  var partsTotal: Int
  var partsDone: Int
  var retries: [UploadJob.Retry]
  var serverSize: Int64?
  var error: String?
  var updatedAt: Date

  init(_ job: UploadJob) {
    id = job.id
    fileUri = job.fileUri
    objectKey = job.objectKey
    uploadId = job.uploadId
    phase = job.phase
    bytesTotal = job.bytesTotal
    bytesConfirmed = job.bytesConfirmed
    partsTotal = job.parts.count
    partsDone = job.partsDone
    retries = job.retries
    serverSize = job.serverSize
    error = job.error
    updatedAt = job.updatedAt
  }
}
