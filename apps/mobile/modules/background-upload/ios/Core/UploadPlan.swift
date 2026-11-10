import Foundation

enum UploadPlanError: Error, Equatable, Sendable {
  case emptyFile
  case partTooSmall(minimum: Int64)
  case tooManyParts(count: Int, maximum: Int)
}

struct UploadPlan: Equatable, Sendable {
  static let minimumPartSize: Int64 = 5 * 1_048_576
  static let maximumPartCount = 10_000

  let fileSize: Int64
  let partSize: Int64

  var partCount: Int { Int((fileSize + partSize - 1) / partSize) }

  init(fileSize: Int64, partSize: Int64) throws {
    guard fileSize > 0 else { throw UploadPlanError.emptyFile }
    guard partSize >= Self.minimumPartSize else { throw UploadPlanError.partTooSmall(minimum: Self.minimumPartSize) }
    self.fileSize = fileSize
    self.partSize = partSize
    guard partCount <= Self.maximumPartCount else {
      throw UploadPlanError.tooManyParts(count: partCount, maximum: Self.maximumPartCount)
    }
  }

  func offset(ofPart number: Int) -> Int64 {
    partSize * Int64(number - 1)
  }

  func size(ofPart number: Int) -> Int64 {
    number < partCount ? partSize : fileSize - offset(ofPart: number)
  }
}
