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

  private let sampleRate: Double
  private let gain: Double
  private var timeline: AudioTimeline
  private var ring: CallAudioRing
  private var mixedUntil: Double?
  private var mixedFrames = 0
  private var lateFrames = 0
  private var clippedSamples = 0

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
      resyncCount: timeline.resyncCount
    )
  }

  mutating func add(_ samples: UnsafeBufferPointer<Int16>, playsAt: Double) -> Double? {
    let placement = timeline.place(frameCount: samples.count, firstFrameCaptureTime: playsAt)
    let kept = UnsafeBufferPointer(rebasing: samples[min(placement.droppedFrames, samples.count)...])
    if let mixedUntil {
      let missed = Int(((mixedUntil - placement.presentationTime) * sampleRate).rounded())
      lateFrames += min(kept.count, max(0, missed))
    }
    ring.write(kept, at: placement.presentationTime)
    return placement.correction
  }

  mutating func mix(_ mic: UnsafeBufferPointer<Int16>, at time: Double) -> [Int16] {
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
