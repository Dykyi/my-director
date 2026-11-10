import Foundation
@testable import CaptureCoreLogic

enum Fixtures {
  static let createdAt = Date(timeIntervalSince1970: 1_800_000_000)
  static let sessionId = "2027-01-15T08-00-00Z-0001"

  static func manifest(id: String = sessionId, createdAt: Date = createdAt) -> SessionManifest {
    SessionManifest(
      id: id,
      createdAt: createdAt,
      room: "mydirector-poc",
      state: .recording,
      config: .defaults,
      device: SessionManifest.Device(model: "iPhone12,1", os: "18.5", app: "0.1.0 (1)")
    )
  }

  static func temporaryDirectory() -> URL {
    FileManager.default.temporaryDirectory.appending(path: "capture-core-tests-\(UUID().uuidString)", directoryHint: .isDirectory)
  }
}
