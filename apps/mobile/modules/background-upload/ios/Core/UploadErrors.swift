import Foundation

let bytesPerMebibyte: Int64 = 1_048_576

enum UploadEngineError: LocalizedError, Equatable {
  case invalidFileUri(String)
  case notEnoughSpace(neededBytes: Int64, freeBytes: Int64)
  case planMismatch
  case unknownUpload(String)

  var errorDescription: String? {
    switch self {
    case .invalidFileUri(let uri): "Not a local file: \(uri)"
    case .notEnoughSpace(let needed, let free):
      "Not enough free space: need \(needed / bytesPerMebibyte) MB, have \(free / bytesPerMebibyte) MB"
    case .planMismatch: "The upload API returned a different part list than requested"
    case .unknownUpload(let id): "No upload with id \(id)"
    }
  }
}

extension UploadPlanError: LocalizedError {
  var errorDescription: String? {
    switch self {
    case .emptyFile: "The file is empty"
    case .partTooSmall(let minimum): "Parts must be at least \(minimum / bytesPerMebibyte) MiB"
    case .tooManyParts(let count, let maximum): "\(count) parts is more than the \(maximum) allowed"
    }
  }
}
