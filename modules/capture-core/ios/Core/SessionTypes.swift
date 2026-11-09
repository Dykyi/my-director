import Foundation

enum SessionPhase: String, Codable, Sendable {
  case idle, preparing, ready, starting, recording, pausing, paused, resuming, stopping
}

enum PauseReason: String, Codable, Sendable {
  case user, phoneCall, audioInterrupted, appBackground, screenLocked
  case cameraInterrupted, cameraError, cameraStalled, micStalled, fileError, diskFull, mediaServicesReset

  var isSystemInterruption: Bool {
    switch self {
    case .phoneCall, .audioInterrupted, .appBackground, .screenLocked, .cameraInterrupted: true
    case .user, .cameraError, .cameraStalled, .micStalled, .fileError, .diskFull, .mediaServicesReset: false
    }
  }
}

enum InterruptionSource: String, Codable, Sendable, Comparable {
  case audioSession, camera, appBackground

  static func < (lhs: Self, rhs: Self) -> Bool { lhs.rawValue < rhs.rawValue }
}

enum CallConnectionState: String, Codable, Sendable { case disconnected, connecting, connected, reconnecting }
enum CallQuality: String, Codable, Sendable { case excellent, good, poor, lost, unknown }

struct CallStatus: Codable, Equatable, Sendable {
  var state: CallConnectionState = .disconnected
  var room: String?
  var remoteParticipants: [String] = []
  var quality: CallQuality = .unknown
  var profile: CallProfileName = .standard
}

enum CaptureErrorCode: String, Codable, Sendable {
  case permissionDenied, configInvalid, cameraFormatUnsupported, cameraUnavailable, cameraStalled, cameraRuntimeError
  case micUnavailable, audioStalled, fileWriterFailed, fileStalled, fileFpsLow, diskSpaceLow, diskFull
  case callConnectFailed, callDisconnected, callPublishFailed, mediaServicesReset, resumeBlocked
  case recoveryUnplayable, invalidState, startInterrupted

  var isRecoverable: Bool {
    switch self {
    case .permissionDenied, .configInvalid, .cameraFormatUnsupported, .recoveryUnplayable: false
    default: true
    }
  }
}

struct Failure: Error, Equatable, Sendable {
  var code: CaptureErrorCode
  var message: String
}

struct CaptureError: Codable, Equatable, Sendable {
  var code: CaptureErrorCode
  var message: String
  var at: Date
  var recoverable: Bool

  init(_ failure: Failure, at date: Date) {
    code = failure.code
    message = failure.message
    at = date
    recoverable = failure.code.isRecoverable
  }
}

struct CaptureWarning: Codable, Equatable, Sendable {
  var code: CaptureErrorCode
  var message: String
  var since: Date
}
