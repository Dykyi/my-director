import Foundation

enum CameraPosition: String, Codable, Sendable { case front, back }
enum RecordingCodec: String, Codable, Sendable { case hevc, h264 }
enum CallCodec: String, Codable, Sendable { case h264, vp8 }
enum CallDegradation: String, Codable, Sendable { case maintainFramerate, maintainResolution, balanced }
enum StabilizationMode: String, Codable, Sendable { case off, standard }
enum ResumePolicy: String, Codable, Sendable { case manual, automatic }

enum ThermalLevel: String, Codable, Sendable, CaseIterable {
  case nominal, fair, serious, critical
}

enum CallProfileName: String, Codable, Sendable, CaseIterable {
  case standard, reduced, minimal

  var rank: Int {
    switch self {
    case .minimal: 0
    case .reduced: 1
    case .standard: 2
    }
  }
}

struct CallVideoProfile: Codable, Equatable, Sendable {
  var width: Int
  var height: Int
  var fps: Int
}

struct CallProfiles: Codable, Equatable, Sendable {
  var standard: CallVideoProfile
  var reduced: CallVideoProfile
  var minimal: CallVideoProfile

  subscript(name: CallProfileName) -> CallVideoProfile {
    switch name {
    case .standard: standard
    case .reduced: reduced
    case .minimal: minimal
    }
  }
}

struct ThermalProfiles: Codable, Equatable, Sendable {
  var nominal: CallProfileName
  var fair: CallProfileName
  var serious: CallProfileName
  var critical: CallProfileName

  subscript(level: ThermalLevel) -> CallProfileName {
    switch level {
    case .nominal: nominal
    case .fair: fair
    case .serious: serious
    case .critical: critical
    }
  }
}

struct CaptureConfig: Codable, Equatable, Sendable {
  struct Camera: Codable, Equatable, Sendable {
    var position: CameraPosition
    var width: Int
    var height: Int
    var fps: Int
    var stabilization: StabilizationMode
  }

  struct Recording: Codable, Equatable, Sendable {
    var codec: RecordingCodec
    var videoBitrate: Int
    var keyFrameIntervalSec: Double
    var audioBitrate: Int
    var fragmentIntervalSec: Double
    var initialFragmentIntervalSec: Double
  }

  struct Call: Codable, Equatable, Sendable {
    var codec: CallCodec
    var simulcast: Bool
    var degradation: CallDegradation
    var profiles: CallProfiles
    var thermalProfiles: ThermalProfiles
    var thermalRecoveryDelaySec: Double
    var connectTimeoutSec: Double
  }

  struct Audio: Codable, Equatable, Sendable {
    var noiseSuppression: Bool
    var autoGainControl: Bool
    var resyncThresholdMs: Double
  }

  struct Session: Codable, Equatable, Sendable {
    var resumePolicy: ResumePolicy
    var heartbeatIntervalSec: Double
    var resumeTimeoutMs: Double
  }

  struct Health: Codable, Equatable, Sendable {
    var videoStallMs: Double
    var audioStallMs: Double
    var fileStallMs: Double
    var micRestartGraceMs: Double
  }

  struct Storage: Codable, Equatable, Sendable {
    var minFreeSpaceToStartMB: Int
    var lowSpaceWarningMB: Int
    var criticalFreeSpaceMB: Int
  }

  var camera: Camera
  var recording: Recording
  var call: Call
  var audio: Audio
  var session: Session
  var health: Health
  var storage: Storage

  static let defaults = CaptureConfig(
    camera: Camera(position: .front, width: 1920, height: 1080, fps: 30, stabilization: .off),
    recording: Recording(
      codec: .hevc,
      videoBitrate: 6_000_000,
      keyFrameIntervalSec: 1,
      audioBitrate: 128_000,
      fragmentIntervalSec: 1,
      initialFragmentIntervalSec: 1
    ),
    call: Call(
      codec: .h264,
      simulcast: false,
      degradation: .maintainFramerate,
      profiles: CallProfiles(
        standard: CallVideoProfile(width: 1280, height: 720, fps: 30),
        reduced: CallVideoProfile(width: 960, height: 540, fps: 24),
        minimal: CallVideoProfile(width: 640, height: 360, fps: 15)
      ),
      thermalProfiles: ThermalProfiles(nominal: .standard, fair: .standard, serious: .reduced, critical: .minimal),
      thermalRecoveryDelaySec: 60,
      connectTimeoutSec: 15
    ),
    audio: Audio(noiseSuppression: true, autoGainControl: true, resyncThresholdMs: 40),
    session: Session(resumePolicy: .manual, heartbeatIntervalSec: 0.5, resumeTimeoutMs: 3000),
    health: Health(videoStallMs: 1000, audioStallMs: 500, fileStallMs: 5000, micRestartGraceMs: 3000),
    storage: Storage(minFreeSpaceToStartMB: 2048, lowSpaceWarningMB: 1024, criticalFreeSpaceMB: 300)
  )
}
