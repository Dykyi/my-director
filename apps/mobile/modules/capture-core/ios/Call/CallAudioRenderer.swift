import AVFAudio
#if canImport(LiveKit)
import LiveKit
#else
import LiveKitClient
#endif

/// LiveKit calls `render` on the playout thread, so it only stamps the time and queues the buffer.
final class CallAudioRenderer: NSObject, AudioRenderer, @unchecked Sendable {
  private let pipeline: MediaPipeline
  private let log: EventLog
  @MainActor private var isAttached = false

  init(pipeline: MediaPipeline, log: EventLog) {
    self.pipeline = pipeline
    self.log = log
  }

  func render(pcmBuffer: AVAudioPCMBuffer) {
    pipeline.handleCallAudio(pcmBuffer, renderedAt: HostClock.now())
  }

  @MainActor func attach() {
    guard !isAttached else { return }
    AudioManager.shared.add(remoteAudioRenderer: self)
    isAttached = true
    log.info("audio", "Call audio renderer attached")
  }

  @MainActor func detach() {
    guard isAttached else { return }
    AudioManager.shared.remove(remoteAudioRenderer: self)
    isAttached = false
    log.info("audio", "Call audio renderer detached")
  }
}
