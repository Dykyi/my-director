import Foundation

enum AudioTail {
  static func silenceFrames(audioEnd: Double, videoEnd: Double, segmentStart: Double, sampleRate: Double) -> Int {
    guard audioEnd > segmentStart, videoEnd > audioEnd else { return 0 }
    return Int(((videoEnd - audioEnd) * sampleRate).rounded())
  }
}
