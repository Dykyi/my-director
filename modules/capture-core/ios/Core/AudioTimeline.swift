import Foundation

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
    var correction: Double?
  }

  static let smoothing = 0.05
  static let medianWindow = 16

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

  mutating func place(frameCount: Int, arrival: Double) -> Placement {
    let sampleRate = configuration.sampleRate
    let observedStart = arrival - Double(frameCount) / sampleRate - configuration.captureLatency
    guard let anchor else {
      self.anchor = observedStart
      emittedFrames = Int64(frameCount)
      return Placement(presentationTime: observedStart, silenceFrames: 0, droppedFrames: 0, correction: nil)
    }

    let expectedStart = anchor + Double(emittedFrames) / sampleRate
    record(drift: observedStart - expectedStart + Double(pendingDropFrames) / sampleRate)

    var silenceFrames: Int64 = 0
    var correction: Double?
    if abs(smoothedDrift) > configuration.resyncThreshold {
      let median = recentDrifts.median
      let frames = Int64((abs(median) * sampleRate).rounded())
      if median > 0 { silenceFrames = frames } else { pendingDropFrames += frames }
      correction = median
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
