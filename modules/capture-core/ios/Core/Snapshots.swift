import Foundation

struct SessionSnapshot: Codable, Equatable, Sendable {
  var phase: SessionPhase
  var sessionId: String?
  var segmentIndex: Int
  var recordedSec: Double
  var pauseReason: PauseReason?
  var activeInterruptions: [InterruptionSource]
  var call: CallStatus
  var thermal: ThermalLevel
  var error: CaptureError?
  var warnings: [CaptureWarning]

  init(state: SessionState, recordedSec: Double) {
    phase = state.phase
    sessionId = state.sessionId
    segmentIndex = state.segmentIndex
    self.recordedSec = recordedSec
    pauseReason = state.pauseReason
    activeInterruptions = state.interruptions.sorted()
    call = state.call
    thermal = state.thermal
    error = state.error
    warnings = state.warnings.values.sorted { ($0.since, $0.code.rawValue) < ($1.since, $1.code.rawValue) }
  }
}

enum SystemPressureLevel: String, Codable, Sendable { case nominal, fair, serious, critical, shutdown }

struct HealthSnapshot: Codable, Equatable, Sendable {
  struct Camera: Codable, Equatable, Sendable {
    var fps: Double
    var width: Int
    var height: Int
  }

  enum WriterState: String, Codable, Sendable { case idle, writing, finishing, failed }

  struct File: Codable, Equatable, Sendable {
    var fps: Double
    var droppedFrames: Int
    var bytes: Int64
    var segmentSec: Double
    var writer: WriterState
  }

  struct Audio: Codable, Equatable, Sendable {
    var levelDb: Double
    var lastBufferAgeMs: Double
    var driftMs: Double
    var resyncCount: Int
    var sampleRate: Double
  }

  enum QualityLimitation: String, Codable, Sendable { case none, cpu, bandwidth, other }

  struct Call: Codable, Equatable, Sendable {
    var sentWidth: Int
    var sentHeight: Int
    var sentFps: Double
    var bitrateKbps: Double
    var droppedFrames: Int
    var qualityLimitation: QualityLimitation
  }

  var at: Date
  var camera: Camera
  var file: File
  var audio: Audio
  var call: Call
  var thermal: ThermalLevel
  var systemPressure: SystemPressureLevel
  var diskFreeBytes: Int64
}
