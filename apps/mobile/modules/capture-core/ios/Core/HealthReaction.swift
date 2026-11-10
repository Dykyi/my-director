enum HealthReaction: Equatable, Sendable {
  case pause(Failure, PauseReason)
  case warn(CaptureErrorCode, String)
  case clearWarning(CaptureErrorCode)
}

extension HealthEdge {
  /// Nil for a recovery that needs nothing: the session stays paused until Resume.
  func reaction(thresholdMs: Int) -> HealthReaction? {
    guard stalled else { return source == .fileAudio ? .clearWarning(.audioStalled) : nil }
    switch source {
    case .camera:
      return .pause(Failure(code: .cameraStalled, message: "No camera frames for \(thresholdMs) ms"), .cameraStalled)
    case .microphone:
      return .pause(Failure(code: .audioStalled, message: "No microphone audio for \(thresholdMs) ms"), .micStalled)
    case .fileVideo:
      return .pause(Failure(code: .fileStalled, message: "Frames stopped reaching the file for \(thresholdMs) ms"), .fileError)
    case .fileBytes:
      return .pause(Failure(code: .fileStalled, message: "The file has not grown for \(thresholdMs) ms"), .fileError)
    case .fileAudio:
      return .warn(.audioStalled, "Audio stopped reaching the file")
    }
  }
}
