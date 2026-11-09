import Foundation

enum DiskSpace {
  static func availableBytes() -> Int64? {
    let values = try? URL.documentsDirectory.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
    return values?.volumeAvailableCapacityForImportantUsage
  }
}
