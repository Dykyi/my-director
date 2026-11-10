import Foundation

/// Capture clock presentation times for the tap's microphone chunks: the sample count keeps time,
/// each chunk's stamp only steers slowly against drift and loss.
struct AudioTimeline: Sendable {
  struct Configuration: Sendable {
    var sampleRate: Double
    var captureLatency: Double
    var resyncThreshold: Double
  }

  struct Placement: Equatable, Sendable {
    var presentationTime: Double
    var silenceFrames: Int
    var droppedFrames: Int
    /// Seconds; positive when the audio fell behind.
    var correction: Double?
  }

  static let smoothing = 0.05
  /// Odd, so the median of a full window is one of the recorded drifts rather than the mean of two.
  static let medianWindow = 15

  let configuration: Configuration
  private var anchor: Double?
  private var emittedFrames: Int64 = 0
  private var pendingDropFrames: Int64 = 0
  private var recentDrifts: [Double] = []
  private(set) var smoothedDrift = 0.0
  private(set) var resyncCount = 0

  init(configuration: Configuration) {
    self.configuration = configuration
  }

  mutating func place(frameCount: Int, firstFrameCaptureTime: Double) -> Placement {
    let sampleRate = configuration.sampleRate
    let observedStart = firstFrameCaptureTime - configuration.captureLatency
    guard let anchor else {
      self.anchor = observedStart
      emittedFrames = Int64(frameCount)
      return Placement(presentationTime: observedStart, silenceFrames: 0, droppedFrames: 0, correction: nil)
    }

    let expectedStart = anchor + Double(emittedFrames) / sampleRate
    // Frames already scheduled for dropping are counted as dropped, so one jump is corrected once.
    record(drift: observedStart - expectedStart + Double(pendingDropFrames) / sampleRate)

    var silenceFrames: Int64 = 0
    var correction: Double?
    if let jump = confirmedJump() {
      let frames = Int64((abs(jump) * sampleRate).rounded())
      if jump > 0 { silenceFrames = frames } else { pendingDropFrames += frames }
      correction = jump
      smoothedDrift = 0
      recentDrifts.removeAll(keepingCapacity: true)
      resyncCount += 1
    }

    let droppedFrames = min(Int64(frameCount), pendingDropFrames)
    pendingDropFrames -= droppedFrames
    emittedFrames += silenceFrames
    let presentationTime = anchor + Double(emittedFrames) / sampleRate
    emittedFrames += Int64(frameCount) - droppedFrames
    return Placement(
      presentationTime: presentationTime,
      silenceFrames: Int(silenceFrames),
      droppedFrames: Int(droppedFrames),
      correction: correction
    )
  }

  /// The smoothed drift says a jump happened; the median, once most recent buffers sit after the jump, says how large.
  /// Nil while either is within the threshold, so a lone outlier or a half-seen jump corrects nothing.
  private func confirmedJump() -> Double? {
    let threshold = configuration.resyncThreshold
    guard abs(smoothedDrift) > threshold else { return nil }
    let median = recentDrifts.median
    return abs(median) > threshold ? median : nil
  }

  private mutating func record(drift: Double) {
    recentDrifts.append(drift)
    if recentDrifts.count > Self.medianWindow { recentDrifts.removeFirst() }
    smoothedDrift += Self.smoothing * (drift - smoothedDrift)
  }
}

private extension [Double] {
  var median: Double {
    let sorted = sorted()
    let middle = sorted.count / 2
    return sorted.count.isMultiple(of: 2) ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
  }
}

extension AudioTimeline.Configuration {
  /// Voice processing delay that `inputLatency` and `ioBufferDuration` leave out, measured with the sync
  /// beacon on the iPhone 11 built-in microphone.
  static let voiceProcessingLatency = 0.0235

  init(sampleRate: Double, inputLatency: Double, ioBufferDuration: Double, resyncThreshold: Double) {
    self.init(
      sampleRate: sampleRate,
      captureLatency: inputLatency + ioBufferDuration + Self.voiceProcessingLatency,
      resyncThreshold: resyncThreshold
    )
  }
}
