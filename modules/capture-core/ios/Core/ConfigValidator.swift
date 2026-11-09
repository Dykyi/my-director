import Foundation

enum ConfigValidator {
  static let fpsRange = 1...60
  static let audioBitrateRange = 64_000...256_000
  static let minKeyFrameIntervalSec = 0.5
  static let minFragmentIntervalSec = 1.0
  static let connectTimeoutRange = 5.0...60.0
  static let resyncThresholdRange = 20.0...200.0
  static let heartbeatRange = 0.5...5.0
  static let resumeTimeoutRange = 1_000.0...10_000.0
  static let minVideoStallMs = 200.0
  static let minAudioStallMs = 100.0

  static func problems(in config: CaptureConfig) -> [String] {
    var problems: [String] = []
    func require(_ condition: Bool, _ message: @autoclosure () -> String) {
      if !condition { problems.append(message()) }
    }

    let camera = config.camera
    require(isEvenPositive(camera.width) && isEvenPositive(camera.height),
            "camera size must be positive even numbers, got \(camera.width)x\(camera.height)")
    require(fpsRange.contains(camera.fps), "camera.fps must be in \(fpsRange), got \(camera.fps)")

    let recording = config.recording
    require(recording.videoBitrate > 0, "recording.videoBitrate must be positive")
    require(audioBitrateRange.contains(recording.audioBitrate), "recording.audioBitrate must be in \(audioBitrateRange)")
    require(recording.keyFrameIntervalSec >= minKeyFrameIntervalSec,
            "recording.keyFrameIntervalSec must be at least \(minKeyFrameIntervalSec)")
    require(recording.fragmentIntervalSec >= minFragmentIntervalSec,
            "recording.fragmentIntervalSec must be at least \(minFragmentIntervalSec)")
    require(recording.initialFragmentIntervalSec >= minFragmentIntervalSec,
            "recording.initialFragmentIntervalSec must be at least \(minFragmentIntervalSec)")

    for name in CallProfileName.allCases {
      let profile = config.call.profiles[name]
      let key = "call.profiles.\(name.rawValue)"
      require(isEvenPositive(profile.width) && isEvenPositive(profile.height), "\(key) size must be positive even numbers")
      require(profile.width <= camera.width && profile.height <= camera.height, "\(key) must not exceed the camera size")
      require(profile.fps >= 1 && profile.fps <= camera.fps, "\(key).fps must be in 1...\(camera.fps)")
    }
    require(config.call.thermalRecoveryDelaySec >= 0, "call.thermalRecoveryDelaySec must not be negative")
    require(connectTimeoutRange.contains(config.call.connectTimeoutSec), "call.connectTimeoutSec must be in \(connectTimeoutRange)")

    require(resyncThresholdRange.contains(config.audio.resyncThresholdMs), "audio.resyncThresholdMs must be in \(resyncThresholdRange)")
    require(heartbeatRange.contains(config.session.heartbeatIntervalSec), "session.heartbeatIntervalSec must be in \(heartbeatRange)")
    require(resumeTimeoutRange.contains(config.session.resumeTimeoutMs), "session.resumeTimeoutMs must be in \(resumeTimeoutRange)")

    let health = config.health
    require(health.videoStallMs >= minVideoStallMs, "health.videoStallMs must be at least \(minVideoStallMs)")
    require(health.audioStallMs >= minAudioStallMs, "health.audioStallMs must be at least \(minAudioStallMs)")
    require(health.fileStallMs > 2 * recording.fragmentIntervalSec * 1000,
            "health.fileStallMs must exceed two fragment intervals")

    let storage = config.storage
    require(storage.criticalFreeSpaceMB > 0
              && storage.criticalFreeSpaceMB < storage.lowSpaceWarningMB
              && storage.lowSpaceWarningMB <= storage.minFreeSpaceToStartMB,
            "storage thresholds must satisfy 0 < critical < lowWarning <= minFreeToStart")
    return problems
  }

  private static func isEvenPositive(_ value: Int) -> Bool {
    value > 0 && value.isMultiple(of: 2)
  }
}
