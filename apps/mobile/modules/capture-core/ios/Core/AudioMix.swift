import Foundation

enum AudioMix {
  struct Result: Equatable, Sendable {
    var samples: [Int16]
    var clipped: Int
  }

  static func gain(db: Double) -> Double {
    pow(10, db / 20)
  }

  static func mix(_ mic: UnsafeBufferPointer<Int16>, _ call: [Int16], gain: Double) -> Result {
    var clipped = 0
    let samples = zip(mic, call).map { mic, call -> Int16 in
      let sum = Double(mic) + (Double(call) * gain).rounded()
      if sum > Double(Int16.max) || sum < Double(Int16.min) { clipped += 1 }
      return Int16(min(max(sum, Double(Int16.min)), Double(Int16.max)))
    }
    return Result(samples: samples, clipped: clipped)
  }
}
