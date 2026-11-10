import Foundation

struct UploadApi: Codable, Equatable, Sendable {
  var baseUrl: String
  var token: String
}

struct CreateUploadRequest: Codable, Equatable, Sendable {
  var key: String
  var size: Int64
  var partSize: Int64
  var partMd5s: [String]
}

struct CreateUploadResponse: Codable, Equatable, Sendable {
  struct Part: Codable, Equatable, Sendable {
    var partNumber: Int
    var url: String
    var headers: [String: String]
  }

  var uploadId: String
  var key: String
  var partSize: Int64
  var expiresAt: String
  var parts: [Part]
}

struct CompleteUploadRequest: Codable, Equatable, Sendable {
  struct Part: Codable, Equatable, Sendable {
    var partNumber: Int
    var etag: String
  }

  var key: String
  var size: Int64
  var parts: [Part]
}

struct CompleteUploadResponse: Codable, Equatable, Sendable {
  var verified: Bool
  var size: Int64?
  var expected: Int64?
  var actual: Int64?
}

struct StartUploadInput: Codable, Equatable, Sendable {
  static let defaultPartSizeMB = 16
  static let defaultMaxAttemptsPerPart = 5

  var fileUri: String
  var objectKey: String
  var api: UploadApi
  var partSizeMB: Int?
  var maxAttemptsPerPart: Int?
}
