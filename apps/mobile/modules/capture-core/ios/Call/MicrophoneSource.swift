import Foundation
#if canImport(LiveKit)
import LiveKit
#else
import LiveKitClient
#endif

/// Keeps LiveKit's audio engine recording with or without a room, so the microphone has one owner
/// and survives call drops.
@MainActor
final class MicrophoneSource {
  private let tap: EngineInputTap
  private let log: EventLog
  private var options: AudioProcessingOptions?
  private(set) var isRunning = false
  private(set) var lastEngineStopAt: Double?

  nonisolated init(pipeline: MediaPipeline, log: EventLog) {
    tap = EngineInputTap(pipeline: pipeline, log: log)
    self.log = log
    let manager = AudioManager.shared
    // Set once, before the engine first starts; LiveKit's own observers keep their order.
    manager.set(engineObservers: [manager.audioSession, manager.mixer, tap])
    tap.onEngineStopped = { [weak self] in
      Task { @MainActor in self?.engineStopped() }
    }
    tap.onEngineStarting = { [weak self] recording in
      Task { @MainActor in self?.engineStarting(recording: recording) }
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
      // Muting the call happens after the tap, so the file keeps the voice while the call is muted.
      try manager.set(microphoneMuteMode: .inputMixer)
      try manager.startLocalRecording(audioProcessingOptions: options)
      if !tap.isInstalled {
        // After a phone call the engine can come back recording with no input wired; a restart wires it again.
        log.info("audio", "Engine records without the microphone tap, restarting it")
        try manager.stopLocalRecording()
        try manager.startLocalRecording(audioProcessingOptions: options)
      }
    } catch {
      throw Failure(code: .micUnavailable, message: error.localizedDescription)
    }
    self.options = options
    isRunning = true
    log.info("audio", "Microphone started", processingReport())
  }

  func stop() {
    guard isRunning else { return }
    // Cleared first, so the engine stop this causes is not taken for a call ending.
    isRunning = false
    do {
      try AudioManager.shared.stopLocalRecording()
    } catch {
      // Fails while a phone call holds the engine; `engineStarting` turns recording off once the engine is back.
      log.info("audio", "stopLocalRecording failed", ["error": error.localizedDescription])
    }
    log.info("audio", "Microphone stopped")
  }

  private func processingReport() -> [String: String] {
    [
      "processing": String(describing: AudioManager.shared.audioProcessingState),
      "platform": String(describing: AudioManager.shared.platformVoiceProcessingState),
    ]
  }

  /// A stop that failed during a phone call leaves LiveKit recording, and it restarts so when the call ends; the
  /// microphone stays off until Resume. Runs after `start` sets `isRunning`, so our own starts pass.
  private func engineStarting(recording: Bool) {
    guard recording, !isRunning else { return }
    log.info("audio", "Engine came back recording while the microphone is off, stopping it")
    do {
      try AudioManager.shared.stopLocalRecording()
    } catch {
      log.warning("audio", "stopLocalRecording failed", ["error": error.localizedDescription])
    }
  }

  /// After a call ends or the route moves nobody else restarts the engine, so it starts again here;
  /// `AudioTimeline` absorbs the gap.
  private func engineStopped() {
    guard isRunning else { return }
    lastEngineStopAt = HostClock.now()
    guard !AudioManager.shared.isEngineRunning else { return }
    do {
      try AudioManager.shared.startLocalRecording(audioProcessingOptions: options)
      log.warning("audio", "Microphone restarted after the engine stopped")
    } catch {
      log.error("audio", "Microphone restart failed", ["error": error.localizedDescription])
    }
  }
}
