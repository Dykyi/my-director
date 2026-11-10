enum RejoinPlan: Equatable, Sendable {
  case keep
  case waitForReconnect
  case rejoin

  init(connection: CallConnectionState?) {
    switch connection {
    case .connected: self = .keep
    case .connecting, .reconnecting: self = .waitForReconnect
    case .disconnected, nil: self = .rejoin
    }
  }

  /// A paused phone joins without tracks and only shares why it is paused: publishing first and muting
  /// after would show the interviewer a live picture for a moment.
  static func publishesTracks(in phase: SessionPhase) -> Bool {
    phase == .recording
  }
}
