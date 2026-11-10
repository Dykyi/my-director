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

enum TrackStatus: String, Codable, Sendable {
  case none, live, muted

  init(isMuted: Bool?) {
    self = isMuted.map { $0 ? .muted : .live } ?? .none
  }
}

struct ParticipantStatus: Codable, Equatable, Sendable {
  var identity: String
  var joinedAt: Date?
  var quality: CallQuality
  var isSpeaking: Bool
  var microphone: TrackStatus
  var camera: TrackStatus

  /// Earliest first, so the interviewer who was waiting stays on top; a missing join time goes last.
  static func ordered(_ participants: [ParticipantStatus]) -> [ParticipantStatus] {
    participants.sorted { ($0.joinedAt ?? .distantFuture, $0.identity) < ($1.joinedAt ?? .distantFuture, $1.identity) }
  }
}

struct CallStatus: Codable, Equatable, Sendable {
  var state: CallConnectionState = .disconnected
  var room: String?
  var identity: String?
  var connectedAt: Date?
  var reconnectCount = 0
  var isMuted = false
  var participants: [ParticipantStatus] = []
  var quality: CallQuality = .unknown
  var profile: CallProfileName = .standard
}

enum CaptureErrorCode: String, Codable, Sendable, CaseIterable {
  case permissionDenied, configInvalid, cameraFormatUnsupported, cameraUnavailable, cameraStalled, cameraRuntimeError
  case micUnavailable, audioStalled, fileWriterFailed, fileStalled, fileFpsLow, diskSpaceLow, diskFull
  case callConnectFailed, callDisconnected, callPublishFailed, mediaServicesReset, resumeBlocked
  case recoveryUnplayable, invalidState, startInterrupted

  /// Exhaustive on purpose: a new code has to be classified here.
  var isRecoverable: Bool {
    switch self {
    case .permissionDenied, .configInvalid, .cameraFormatUnsupported, .recoveryUnplayable:
      false
    case .cameraUnavailable, .cameraStalled, .cameraRuntimeError,
         .micUnavailable, .audioStalled, .fileWriterFailed, .fileStalled, .fileFpsLow, .diskSpaceLow, .diskFull,
         .callConnectFailed, .callDisconnected, .callPublishFailed, .mediaServicesReset, .resumeBlocked,
         .invalidState, .startInterrupted:
      true
    }
  }
}

struct Failure: LocalizedError, Equatable, Sendable {
  var code: CaptureErrorCode
  var message: String

  /// What a JS promise rejection shows instead of "CaptureCore.Failure error 1".
  var errorDescription: String? { "\(code.rawValue): \(message)" }
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
