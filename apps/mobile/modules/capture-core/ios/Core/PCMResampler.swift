import AVFAudio

/// The tap delivers whatever rate and layout the route gives; Bluetooth HFP runs at 16 kHz.
struct PCMResampler {
  static let fileFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 48_000, channels: 1, interleaved: false)!
  /// Room for the converter's carry-over between buffers.
  private static let slackFrames: AVAudioFrameCount = 64

  private let converter: AVAudioConverter

  init?(from format: AVAudioFormat) {
    guard let converter = AVAudioConverter(from: format, to: Self.fileFormat) else { return nil }
    self.converter = converter
  }

  func convert(_ buffer: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
    let ratio = Self.fileFormat.sampleRate / converter.inputFormat.sampleRate
    let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up)) + Self.slackFrames
    guard let output = AVAudioPCMBuffer(pcmFormat: Self.fileFormat, frameCapacity: capacity) else { return nil }
    var delivered = false
    var error: NSError?
    converter.convert(to: output, error: &error) { _, status in
      if delivered {
        status.pointee = .noDataNow
        return nil
      }
      delivered = true
      status.pointee = .haveData
      return buffer
    }
    return error == nil && output.frameLength > 0 ? output : nil
  }
}
