struct DiskSpacePolicy: Sendable {
  private static let bytesPerMebibyte: Int64 = 1_048_576

  private let storage: CaptureConfig.Storage
  private let recording: CaptureConfig.Recording

  init(_ config: CaptureConfig) {
    storage = config.storage
    recording = config.recording
  }

  func failureToStart(freeBytes: Int64) -> Failure? {
    let freeMB = freeBytes / Self.bytesPerMebibyte
    guard freeMB < Int64(storage.minFreeSpaceToStartMB) else { return nil }
    return Failure(code: .diskFull, message: "Need \(storage.minFreeSpaceToStartMB) MB free to start, \(freeMB) MB available")
  }

  func reaction(freeBytes: Int64, isRecording: Bool) -> HealthReaction {
    let freeMB = freeBytes / Self.bytesPerMebibyte
    if isRecording, freeMB < Int64(storage.criticalFreeSpaceMB) {
      return .pause(Failure(code: .diskFull, message: "Only \(freeMB) MB left"), .diskFull)
    }
    if freeMB < Int64(storage.lowSpaceWarningMB) {
      return .warn(.diskSpaceLow, "\(freeMB) MB left, about \(minutesOfRecording(fitting: freeBytes)) min of recording")
    }
    return .clearWarning(.diskSpaceLow)
  }

  private func minutesOfRecording(fitting bytes: Int64) -> Int64 {
    let bytesPerMinute = Int64(recording.videoBitrate + recording.audioBitrate) / 8 * 60
    return bytes / max(bytesPerMinute, 1)
  }
}
