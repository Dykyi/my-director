import Foundation

enum DiskSpace {
  /// Space iOS will free for important data such as a recording.
  static func availableBytes() -> Int64? {
    let values = try? URL.documentsDirectory.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
    return values?.volumeAvailableCapacityForImportantUsage
  }
}
