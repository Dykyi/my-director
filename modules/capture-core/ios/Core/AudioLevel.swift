import Foundation

enum AudioLevel {
  static let floorDb = -120.0
  private static let fullScale = 32_768.0

  static func rmsDb(_ samples: UnsafeBufferPointer<Int16>) -> Double {
    guard !samples.isEmpty else { return floorDb }
    let sumOfSquares = samples.reduce(0.0) { sum, sample in
      let normalized = Double(sample) / fullScale
      return sum + normalized * normalized
    }
    let rms = (sumOfSquares / Double(samples.count)).squareRoot()
    return rms > 0 ? max(floorDb, 20 * log10(rms)) : floorDb
  }
}
