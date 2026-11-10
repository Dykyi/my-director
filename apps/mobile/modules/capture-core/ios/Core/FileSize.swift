import Foundation

extension URL {
  var fileSize: Int64 {
    Int64((try? resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0)
  }
}
