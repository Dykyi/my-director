import AVFoundation

enum RecoveryInspector {
  static func inspect(_ url: URL) async -> SegmentInspection {
    let bytes = Int64((try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize).flatMap { $0 } ?? 0)
    let asset = AVURLAsset(url: url)
    do {
      guard try await asset.load(.isPlayable) else {
        return SegmentInspection(playable: false, durationSec: 0, bytes: bytes, failureReason: "AVFoundation reports the file as not playable")
      }
      let times = try await FrameTimeReader.presentationTimes(of: asset)
      guard let first = times.first, let last = times.last else {
        return SegmentInspection(playable: false, durationSec: 0, bytes: bytes, failureReason: "No video frames survived")
      }
      let frameDuration = times.count > 1 ? (last - first) / Double(times.count - 1) : 0
      return SegmentInspection(playable: true, durationSec: last - first + frameDuration, bytes: bytes, failureReason: nil)
    } catch {
      return SegmentInspection(playable: false, durationSec: 0, bytes: bytes, failureReason: error.localizedDescription)
    }
  }
}
