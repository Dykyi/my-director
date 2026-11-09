import CryptoKit
import Foundation
import Testing
@testable import BackgroundUploadLogic

final class PartSlicerTests {
  private let directory = FileManager.default.temporaryDirectory.appending(path: "slicer-\(UUID().uuidString)", directoryHint: .isDirectory)

  init() throws {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  }

  deinit {
    try? FileManager.default.removeItem(at: directory)
  }

  @Test func partsReassembleTheFileAndCarryTheirDigests() throws {
    let source = directory.appending(path: "source.bin")
    let bytes = Data((0..<(12 * 1_048_576)).map { UInt8(truncatingIfNeeded: $0 &* 31) })
    try bytes.write(to: source)
    let plan = try UploadPlan(fileSize: Int64(bytes.count), partSize: UploadPlan.minimumPartSize)

    let parts = try PartSlicer.slice(file: source, plan: plan, into: directory.appending(path: "parts"))

    #expect(parts.map(\.size) == [5_242_880, 5_242_880, 2_097_152])
    let reassembled = try parts.reduce(into: Data()) { $0.append(try Data(contentsOf: $1.url)) }
    #expect(reassembled == bytes)
    for part in parts {
      let expected = Data(Insecure.MD5.hash(data: try Data(contentsOf: part.url))).base64EncodedString()
      #expect(part.md5Base64 == expected)
      #expect(try PartSlicer.md5Base64(of: part.url) == expected)
    }
  }
}
