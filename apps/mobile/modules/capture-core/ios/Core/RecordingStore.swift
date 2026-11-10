import Foundation

struct RecordingStore: Sendable {
  static let manifestFileName = "session.json"
  static let eventsFileName = "events.jsonl"
  static let verificationFileName = "verification.json"

  struct ScanResult: Sendable {
    var manifests: [SessionManifest]
    var unreadable: [String]
  }

  let root: URL

  func directory(for sessionId: String) -> URL {
    root.appending(path: sessionId, directoryHint: .isDirectory)
  }

  func segmentURL(sessionId: String, index: Int) -> URL {
    directory(for: sessionId).appending(path: SessionManifest.Segment.fileName(for: index))
  }

  func eventsURL(sessionId: String) -> URL {
    directory(for: sessionId).appending(path: Self.eventsFileName)
  }

  func verificationURL(sessionId: String) -> URL {
    directory(for: sessionId).appending(path: Self.verificationFileName)
  }

  func create(_ manifest: SessionManifest) throws {
    try FileManager.default.createDirectory(
      at: directory(for: manifest.id),
      withIntermediateDirectories: true,
      attributes: Self.directoryAttributes
    )
    try save(manifest)
  }

  func save(_ manifest: SessionManifest) throws {
    try Self.write(JSONCoding.encoder().encode(manifest), to: directory(for: manifest.id).appending(path: Self.manifestFileName))
  }

  func load(_ sessionId: String) throws -> SessionManifest {
    let data = try Data(contentsOf: directory(for: sessionId).appending(path: Self.manifestFileName))
    return try JSONCoding.decoder().decode(SessionManifest.self, from: data)
  }

  func scan() -> ScanResult {
    let fileManager = FileManager.default
    var result = ScanResult(manifests: [], unreadable: [])
    guard let names = try? fileManager.contentsOfDirectory(atPath: root.path(percentEncoded: false)) else {
      return result
    }
    for name in names {
      let manifestPath = directory(for: name).appending(path: Self.manifestFileName).path(percentEncoded: false)
      guard fileManager.fileExists(atPath: manifestPath) else { continue }
      do {
        result.manifests.append(try load(name))
      } catch {
        result.unreadable.append(name)
      }
    }
    result.manifests.sort { $0.createdAt > $1.createdAt }
    return result
  }

  func delete(_ sessionId: String) throws {
    try FileManager.default.removeItem(at: directory(for: sessionId))
  }

  static func write(_ data: Data, to url: URL) throws {
    #if os(iOS)
    try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    #else
    try data.write(to: url, options: [.atomic])
    #endif
  }

  static var directoryAttributes: [FileAttributeKey: Any]? {
    #if os(iOS)
    [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
    #else
    nil
    #endif
  }
}
