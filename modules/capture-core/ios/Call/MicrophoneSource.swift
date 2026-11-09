import Foundation
#if canImport(LiveKit)
import LiveKit
#else
import LiveKitClient
#endif

@MainActor
final class MicrophoneSource {
  private let tap: EngineInputTap
  private let log: EventLog
  private var options: AudioProcessingOptions?
  private(set) var isRunning = false

  nonisolated init(pipeline: MediaPipeline, log: EventLog) {
    tap = EngineInputTap(pipeline: pipeline, log: log)
    self.log = log
    let manager = AudioManager.shared
    manager.set(engineObservers: [manager.audioSession, manager.mixer, tap])
    tap.onEngineStopped = { [weak self] in
      Task { @MainActor in self?.restartAfterEngineStop() }
    }
  }

  func start(_ audio: CaptureConfig.Audio) throws {
    guard !isRunning else { return }
    let manager = AudioManager.shared
    manager.isSpeakerOutputPreferred = true
    let options = AudioProcessingOptions(
      echoCancellation: true,
      autoGainControl: audio.autoGainControl,
      noiseSuppression: audio.noiseSuppression
    )
    do {
      try manager.set(microphoneMuteMode: .inputMixer)
      try manager.startLocalRecording(audioProcessingOptions: options)
    } catch {
      throw Failure(code: .micUnavailable, message: error.localizedDescription)
    }
    self.options = options
    isRunning = true
    log.info("audio", "Microphone started", processingReport())
  }

  func stop() {
    guard isRunning else { return }
    isRunning = false
    do {
      try AudioManager.shared.stopLocalRecording()
    } catch {
      log.warning("audio", "stopLocalRecording failed", ["error": error.localizedDescription])
    }
    log.info("audio", "Microphone stopped")
  }

  func processingReport() -> [String: String] {
    [
      "processing": String(describing: AudioManager.shared.audioProcessingState),
      "platform": String(describing: AudioManager.shared.platformVoiceProcessingState),
    ]
  }

  private func restartAfterEngineStop() {
    guard isRunning, !AudioManager.shared.isEngineRunning else { return }
    do {
      try AudioManager.shared.startLocalRecording(audioProcessingOptions: options)
      log.warning("audio", "Microphone restarted after the engine stopped")
    } catch {
      log.error("audio", "Microphone restart failed", ["error": error.localizedDescription])
    }
  }
}
