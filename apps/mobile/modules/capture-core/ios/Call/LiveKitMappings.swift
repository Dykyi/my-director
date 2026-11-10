import Foundation
#if canImport(LiveKit)
import LiveKit
#else
import LiveKitClient
#endif

extension CallConnectionState {
  init(_ state: ConnectionState) {
    switch state {
    case .connected: self = .connected
    case .connecting: self = .connecting
    case .reconnecting: self = .reconnecting
    default: self = .disconnected
    }
  }
}

extension CallQuality {
  init(_ quality: ConnectionQuality) {
    switch quality {
    case .excellent: self = .excellent
    case .good: self = .good
    case .poor: self = .poor
    case .lost: self = .lost
    default: self = .unknown
    }
  }
}

extension CallDegradation {
  var liveKitPreference: DegradationPreference {
    switch self {
    case .maintainFramerate: .maintainFramerate
    case .maintainResolution: .maintainResolution
    case .balanced: .balanced
    }
  }
}

extension ParticipantStatus {
  /// `getTrackPublication(source:)` is internal to LiveKit, so the publications are searched here.
  init(_ participant: RemoteParticipant) {
    let publications = participant.trackPublications.values
    self.init(
      identity: participant.displayIdentity,
      joinedAt: participant.joinedAt,
      quality: CallQuality(participant.connectionQuality),
      isSpeaking: participant.isSpeaking,
      microphone: TrackStatus(isMuted: publications.first { $0.source == .microphone }?.isMuted),
      camera: TrackStatus(isMuted: publications.first { $0.source == .camera }?.isMuted)
    )
  }
}

extension Participant {
  var displayIdentity: String { identity?.stringValue ?? "?" }
}
