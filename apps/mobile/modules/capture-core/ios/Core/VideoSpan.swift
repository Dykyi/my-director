import CoreMedia

struct VideoSpan: Sendable {
  let start: CMTime
  private let frameDuration: CMTime
  private var lastFrame: CMTime?

  init(start: CMTime, fps: Int) {
    self.start = start
    frameDuration = CMTime(value: 1, timescale: CMTimeScale(fps))
  }

  mutating func appended(at time: CMTime) {
    lastFrame = time
  }

  /// Nil while no frame is in: the encoder can skip the very first one.
  var end: CMTime? { lastFrame.map { $0 + frameDuration } }

  var durationSec: Double { end.map { ($0 - start).seconds } ?? 0 }
}
