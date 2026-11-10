import Foundation

struct UploadJobStore: Sendable {
  static let jobFileName = "job.json"
  static let completeFileName = "complete.json"
  static let eventsFileName = "events.jsonl"

  let root: URL

  func directory(for jobId: String) -> URL { root.appending(path: jobId, directoryHint: .isDirectory) }
  func partsDirectory(for jobId: String) -> URL { directory(for: jobId).appending(path: "parts", directoryHint: .isDirectory) }
  func partURL(jobId: String, number: Int) -> URL { partsDirectory(for: jobId).appending(path: PartSlicer.fileName(forPart: number)) }
  func completeURL(for jobId: String) -> URL { directory(for: jobId).appending(path: Self.completeFileName) }
  func eventsURL(for jobId: String) -> URL { directory(for: jobId).appending(path: Self.eventsFileName) }

  /// Not in Caches: iOS may purge Caches in the middle of an upload. Excluded from backups.
  func prepare(_ jobId: String) throws {
    var directory = self.directory(for: jobId)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: UploadFiles.attributes)
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try directory.setResourceValues(values)
  }

  func save(_ job: UploadJob) throws {
    try write(UploadCoding.encoder().encode(job), to: directory(for: job.id).appending(path: Self.jobFileName))
  }

  func write(_ data: Data, to url: URL) throws {
    #if os(iOS)
    try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    #else
    try data.write(to: url, options: [.atomic])
    #endif
  }

  func loadAll() -> (jobs: [UploadJob], unreadable: [String]) {
    let names = (try? FileManager.default.contentsOfDirectory(atPath: root.path(percentEncoded: false))) ?? []
    var jobs: [UploadJob] = []
    var unreadable: [String] = []
    for name in names {
      let url = directory(for: name).appending(path: Self.jobFileName)
      guard let data = try? Data(contentsOf: url) else { continue }
      do {
        jobs.append(try UploadCoding.decoder().decode(UploadJob.self, from: data))
      } catch {
        unreadable.append(name)
      }
    }
    return (jobs.sorted { $0.updatedAt > $1.updatedAt }, unreadable)
  }

  func removeParts(of jobId: String) throws {
    try FileManager.default.removeItem(at: partsDirectory(for: jobId))
  }
}

enum UploadCoding {
  private static let dateStyle = Date.ISO8601FormatStyle(includingFractionalSeconds: true)

  static func encoder() -> JSONEncoder {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    encoder.dateEncodingStrategy = .custom { date, encoder in
      var container = encoder.singleValueContainer()
      try container.encode(date.formatted(dateStyle))
    }
    return encoder
  }

  static func decoder() -> JSONDecoder {
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .custom { decoder in
      try dateStyle.parse(decoder.singleValueContainer().decode(String.self))
    }
    return decoder
  }
}
