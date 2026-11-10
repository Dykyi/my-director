import CryptoKit
import Foundation

struct SlicedPart: Equatable, Sendable {
  var number: Int
  var url: URL
  var size: Int64
  var md5Base64: String
}

/// Background upload tasks send whole files only, so the recording is cut into part files, hashing as it goes.
enum PartSlicer {
  static let readChunkSize = Int(bytesPerMebibyte)

  static func fileName(forPart number: Int) -> String { String(format: "part-%05d.bin", number) }

  static func slice(file: URL, plan: UploadPlan, into directory: URL) throws -> [SlicedPart] {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: UploadFiles.attributes)
    let input = try FileHandle(forReadingFrom: file)
    defer { try? input.close() }
    return try (1...plan.partCount).map { number in
      let url = directory.appending(path: fileName(forPart: number))
      guard FileManager.default.createFile(atPath: url.path(percentEncoded: false), contents: nil, attributes: UploadFiles.attributes) else {
        throw CocoaError(.fileWriteUnknown, userInfo: [NSFilePathErrorKey: url.path(percentEncoded: false)])
      }
      let output = try FileHandle(forWritingTo: url)
      defer { try? output.close() }
      var hasher = Insecure.MD5()
      var remaining = plan.size(ofPart: number)
      while remaining > 0 {
        guard let chunk = try input.read(upToCount: Int(min(Int64(readChunkSize), remaining))), !chunk.isEmpty else {
          throw CocoaError(.fileReadCorruptFile, userInfo: [NSFilePathErrorKey: file.path(percentEncoded: false)])
        }
        hasher.update(data: chunk)
        try output.write(contentsOf: chunk)
        remaining -= Int64(chunk.count)
      }
      return SlicedPart(number: number, url: url, size: plan.size(ofPart: number), md5Base64: Data(hasher.finalize()).base64EncodedString())
    }
  }

  /// Re-reads a part after storage rejected its Content-MD5 (HTTP 400): was the file damaged on disk or in transit?
  static func md5Base64(of url: URL) throws -> String {
    let input = try FileHandle(forReadingFrom: url)
    defer { try? input.close() }
    var hasher = Insecure.MD5()
    while let chunk = try input.read(upToCount: readChunkSize), !chunk.isEmpty {
      hasher.update(data: chunk)
    }
    return Data(hasher.finalize()).base64EncodedString()
  }
}

/// Upload files must stay readable while the phone is locked: nsurlsessiond reads them then.
enum UploadFiles {
  static var attributes: [FileAttributeKey: Any]? {
    #if os(iOS)
    [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
    #else
    nil
    #endif
  }
}
