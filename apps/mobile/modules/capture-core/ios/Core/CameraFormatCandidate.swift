struct CameraFormatCandidate: Equatable, Sendable {
  var width: Int
  var height: Int
  var isFullRange420: Bool
  var frameRateRanges: [ClosedRange<Double>]
  var isBinned: Bool

  var maxFrameRate: Double { frameRateRanges.map(\.upperBound).max() ?? 0 }

  static func bestIndex(in candidates: [Self], for camera: CaptureConfig.Camera) -> Int? {
    let fps = Double(camera.fps)
    return candidates.indices
      .filter { index in
        let candidate = candidates[index]
        return candidate.width == camera.width
          && candidate.height == camera.height
          && candidate.isFullRange420
          && candidate.frameRateRanges.contains { $0.contains(fps) }
      }
      .min { lhs, rhs in
        if candidates[lhs].isBinned != candidates[rhs].isBinned { return !candidates[lhs].isBinned }
        return candidates[lhs].maxFrameRate < candidates[rhs].maxFrameRate
      }
  }
}
