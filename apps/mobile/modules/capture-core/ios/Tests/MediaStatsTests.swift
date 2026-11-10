import Testing
@testable import CaptureCoreLogic

struct MediaStatsTests {
  @Test func audioAgeIsUnknownBeforeTheFirstBuffer() {
    #expect(HealthSnapshot.Audio(MediaStats(), now: 100).lastBufferAgeMs == -1)
  }

  @Test func snapshotSectionsReadTheStats() {
    var stats = MediaStats()
    (0..<31).forEach { stats.cameraRate.tick(at: 99 + Double($0) / 30) }
    stats.cameraWidth = 1920
    stats.cameraHeight = 1080
    stats.fileDroppedFrames = 2
    stats.segmentSec = 12.5
    stats.writerState = .writing
    stats.lastAudioHostTime = 99.9
    stats.audioDriftMs = -8
    stats.audioSampleRate = 48_000
    #expect(HealthSnapshot.Camera(stats, now: 100) == .init(fps: 30, width: 1920, height: 1080))
    #expect(HealthSnapshot.File(stats, now: 100, bytes: 4096) == .init(fps: 0, droppedFrames: 2, bytes: 4096, segmentSec: 12.5, writer: .writing))
    let audio = HealthSnapshot.Audio(stats, now: 100)
    #expect(abs(audio.lastBufferAgeMs - 100) < 1e-6)
    #expect(audio.driftMs == -8)
    #expect(audio.sampleRate == 48_000)
  }
}
