import Foundation

struct CallAudioMix: Sendable {
  struct Summary: Equatable, Sendable {
    var mixedSec: Double
    var lateSec: Double
    var clippedSamples: Int
    var resyncCount: Int
  }

  /// Far more than the microphone's 100 ms chunks need.
  static let ringSec = 2.0
  /// A jump this large is the playout stopping or the route changing, not drift: the call's clock starts again
  /// at once, where waiting for the timeline to confirm it would put the first chunks at the old place.
  static let restartJumpSec = 0.1

  private let sampleRate: Double
  private let gain: Double
  private var timeline: AudioTimeline
  private var ring: CallAudioRing
  private var callEnd: Double?
  private var mixedUntil: Double?
  private var mixedFrames = 0
  private var lateFrames = 0
  private var clippedSamples = 0
  private var resyncCount = 0

  init(sampleRate: Double, resyncThreshold: Double, gainDb: Double) {
    self.sampleRate = sampleRate
    gain = AudioMix.gain(db: gainDb)
    timeline = AudioTimeline(configuration: .init(sampleRate: sampleRate, captureLatency: 0, resyncThreshold: resyncThreshold))
    ring = CallAudioRing(sampleRate: sampleRate, capacitySec: Self.ringSec)
  }

  var hasAudio: Bool { ring.endTime != nil }

  var summary: Summary {
    Summary(
      mixedSec: Double(mixedFrames) / sampleRate,
      lateSec: Double(lateFrames) / sampleRate,
      clippedSamples: clippedSamples,
      resyncCount: resyncCount
    )
  }

  mutating func add(_ samples: UnsafeBufferPointer<Int16>, playsAt: Double) -> Double? {
    // A capture clock torn down mid-conversion gives NaN; a frame number cannot be made of it.
    guard playsAt.isFinite else { return nil }
    let restart = callEnd.map { playsAt - $0 }.flatMap { abs($0) > Self.restartJumpSec ? $0 : nil }
    if restart != nil { timeline = AudioTimeline(configuration: timeline.configuration) }
    let placement = timeline.place(frameCount: samples.count, firstFrameCaptureTime: playsAt)
    let kept = UnsafeBufferPointer(rebasing: samples[min(placement.droppedFrames, samples.count)...])
    if let mixedUntil {
      let missed = Int(((mixedUntil - placement.presentationTime) * sampleRate).rounded())
      lateFrames += min(kept.count, max(0, missed))
    }
    ring.write(kept, at: placement.presentationTime)
    callEnd = placement.presentationTime + Double(kept.count) / sampleRate
    let correction = restart ?? placement.correction
    if correction != nil { resyncCount += 1 }
    return correction
  }

  mutating func mix(_ mic: UnsafeBufferPointer<Int16>, at time: Double) -> [Int16] {
    guard time.isFinite else { return Array(mic) }
    let call = ring.read(from: time, count: mic.count)
    let mixed = AudioMix.mix(mic, call.samples, gain: gain)
    let end = time + Double(mic.count) / sampleRate
    mixedUntil = max(mixedUntil ?? end, end)
    mixedFrames += call.covered
    clippedSamples += mixed.clipped
    return mixed.samples
  }
}

extension CallAudioMix.Summary {
  var logData: [String: String] {
    [
      "mixedSec": mixedSec.oneDecimal,
      "lateMs": (lateSec * 1000).oneDecimal,
      "clippedSamples": String(clippedSamples),
      "resyncCount": String(resyncCount),
    ]
  }
}
