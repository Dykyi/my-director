import Foundation

/// iOS takes the mic a moment before a segment closes (a call, another app's audio); silence keeps both tracks as long.
enum AudioTail {
  static func silenceFrames(audioEnd: Double, videoEnd: Double, segmentStart: Double, sampleRate: Double) -> Int {
    guard audioEnd > segmentStart, videoEnd > audioEnd else { return 0 }
    return Int(((videoEnd - audioEnd) * sampleRate).rounded())
  }
}
