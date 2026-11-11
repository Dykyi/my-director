struct MediaStats: Sendable {
  var cameraRate = RateMeter()
  var cameraWidth = 0
  var cameraHeight = 0
  var cameraDroppedFrames = 0
  var fileRate = RateMeter()
  var fileDroppedFrames = 0
  var writerState = HealthSnapshot.WriterState.idle
  var segmentSec = 0.0
  var audioLevelDb = AudioLevel.floorDb
  var lastAudioHostTime = 0.0
  var audioSampleRate = 0.0
  var audioDriftMs = 0.0
  var audioResyncCount = 0
  var callAudioLevelDb = AudioLevel.floorDb
  var lastCallAudioHostTime = 0.0
}

extension HealthSnapshot.Camera {
  init(_ stats: MediaStats, now: Double) {
    self.init(fps: stats.cameraRate.rate(at: now), width: stats.cameraWidth, height: stats.cameraHeight)
  }
}

extension HealthSnapshot.File {
  init(_ stats: MediaStats, now: Double, bytes: Int64) {
    self.init(
      fps: stats.fileRate.rate(at: now),
      droppedFrames: stats.fileDroppedFrames,
      bytes: bytes,
      segmentSec: stats.segmentSec,
      writer: stats.writerState
    )
  }
}

extension HealthSnapshot.Audio {
  /// The call's level holds through the gaps between its chunks, then the call reads as off.
  static let callLevelHoldSec = 0.5

  init(_ stats: MediaStats, now: Double) {
    self.init(
      levelDb: stats.audioLevelDb,
      lastBufferAgeMs: stats.lastAudioHostTime > 0 ? (now - stats.lastAudioHostTime) * 1000 : -1,
      driftMs: stats.audioDriftMs,
      resyncCount: stats.audioResyncCount,
      sampleRate: stats.audioSampleRate,
      callLevelDb: now - stats.lastCallAudioHostTime < Self.callLevelHoldSec ? stats.callAudioLevelDb : nil
    )
  }
}
