import AVFAudio
import os
#if canImport(LiveKit)
import LiveKit
#else
import LiveKitClient
#endif

/// Taps LiveKit's engine input right after voice processing: its local renderer is silent without a sent
/// track. Every engine rewire, a Bluetooth route switch included, reinstalls the tap in the new format.
final class EngineInputTap: AudioEngineObserver, @unchecked Sendable {
  /// A hint only: iOS picks the real tap size, which is why every buffer carries its own capture time.
  private static let tapFrames: AVAudioFrameCount = 480
  /// About a second in, when the engine has settled: the buffer whose timing goes to the log.
  private static let timingSampleBuffer = 10

  private let pipeline: MediaPipeline
  private let log: EventLog
  private let state = OSAllocatedUnfairLock<State>(initialState: State())

  private struct State {
    var next: (any AudioEngineObserver)?
    var tapped: AVAudioNode?
    var onEngineStopped: (@Sendable () -> Void)?
    var onEngineStarting: (@Sendable (_ recording: Bool) -> Void)?
    var buffersSinceInstall = 0
  }

  var next: (any AudioEngineObserver)? {
    get { state.withLock { $0.next } }
    set { state.withLock { $0.next = newValue } }
  }

  /// False while the engine runs with no input wired, as LiveKit can leave it after a phone call.
  var isInstalled: Bool { state.withLock { $0.tapped != nil } }

  var onEngineStopped: (@Sendable () -> Void)? {
    get { state.withLock { $0.onEngineStopped } }
    set { state.withLock { $0.onEngineStopped = newValue } }
  }

  var onEngineStarting: (@Sendable (_ recording: Bool) -> Void)? {
    get { state.withLock { $0.onEngineStarting } }
    set { state.withLock { $0.onEngineStarting = newValue } }
  }

  init(pipeline: MediaPipeline, log: EventLog) {
    self.pipeline = pipeline
    self.log = log
  }

  func engineWillConnectInput(
    _ engine: AVAudioEngine, src: AVAudioNode?, dst: AVAudioNode, format: AVAudioFormat, context: [AnyHashable: Any]
  ) -> Int {
    let result = next?.engineWillConnectInput(engine, src: src, dst: dst, format: format, context: context) ?? 0
    if let src { install(on: src) }
    return result
  }

  func engineWillStart(_ engine: AVAudioEngine, isPlayoutEnabled: Bool, isRecordingEnabled: Bool) -> Int {
    logLifecycle("Audio engine starting", isPlayoutEnabled: isPlayoutEnabled, isRecordingEnabled: isRecordingEnabled)
    onEngineStarting?(isRecordingEnabled)
    return next?.engineWillStart(engine, isPlayoutEnabled: isPlayoutEnabled, isRecordingEnabled: isRecordingEnabled) ?? 0
  }

  func engineDidStop(_ engine: AVAudioEngine, isPlayoutEnabled: Bool, isRecordingEnabled: Bool) -> Int {
    removeTap()
    logLifecycle("Audio engine stopped", isPlayoutEnabled: isPlayoutEnabled, isRecordingEnabled: isRecordingEnabled)
    let result = next?.engineDidStop(engine, isPlayoutEnabled: isPlayoutEnabled, isRecordingEnabled: isRecordingEnabled) ?? 0
    onEngineStopped?()
    return result
  }

  func engineWillRelease(_ engine: AVAudioEngine) -> Int {
    removeTap()
    return next?.engineWillRelease(engine) ?? 0
  }

  private func install(on node: AVAudioNode) {
    removeTap()
    let format = node.outputFormat(forBus: 0)
    guard let resampler = PCMResampler(from: format) else {
      log.error("audio", "Microphone format has no converter", ["format": format.description])
      return
    }
    node.installTap(onBus: 0, bufferSize: Self.tapFrames, format: format) { [pipeline, weak self] buffer, when in
      let stampedAt = AVAudioTime.seconds(forHostTime: when.hostTime)
      self?.logTimingOnce(buffer, stampedAt: stampedAt)
      guard let converted = resampler.convert(buffer) else { return }
      pipeline.handleAudio(converted, firstFrameHostTime: stampedAt)
    }
    state.withLock {
      $0.tapped = node
      $0.buffersSinceInstall = 0
    }
    let input = AVAudioSession.sharedInstance().currentRoute.inputs.first
    log.info("audio", "Microphone tap installed", [
      "format": "\(Int(format.sampleRate)) Hz, \(format.channelCount) ch",
      "input": input.map { "\($0.portName) (\($0.portType.rawValue))" } ?? "none",
    ])
  }

  private func logTimingOnce(_ buffer: AVAudioPCMBuffer, stampedAt: Double) {
    let count = state.withLock { state in
      state.buffersSinceInstall += 1
      return state.buffersSinceInstall
    }
    guard count == Self.timingSampleBuffer else { return }
    let session = AVAudioSession.sharedInstance()
    log.info("audio", "Microphone tap timing", [
      "frames": String(buffer.frameLength),
      "sampleRate": String(Int(buffer.format.sampleRate)),
      "stampBehindDeliveryMs": ((HostClock.now() - stampedAt) * 1000).oneDecimal,
      "inputLatencyMs": (session.inputLatency * 1000).oneDecimal,
      "ioBufferMs": (session.ioBufferDuration * 1000).oneDecimal,
    ])
  }

  private func logLifecycle(_ message: String, isPlayoutEnabled: Bool, isRecordingEnabled: Bool) {
    log.info("audio", message, ["playout": String(isPlayoutEnabled), "recording": String(isRecordingEnabled)])
  }

  private func removeTap() {
    state.withLock { $0.tapped }?.removeTap(onBus: 0)
    state.withLock { $0.tapped = nil }
  }
}
