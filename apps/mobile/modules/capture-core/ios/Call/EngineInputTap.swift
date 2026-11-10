import AVFAudio
import os
#if canImport(LiveKit)
import LiveKit
#else
import LiveKitClient
#endif

final class EngineInputTap: AudioEngineObserver, @unchecked Sendable {
  static let fileFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 48_000, channels: 1, interleaved: false)!
  /// A hint only: iOS picks the real tap size, which is why every buffer carries its own capture time.
  private static let tapFrames: AVAudioFrameCount = 480
  private static let resamplerSlackFrames: AVAudioFrameCount = 64
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
    guard let converter = AVAudioConverter(from: format, to: Self.fileFormat) else {
      log.error("audio", "Microphone format has no converter", ["format": format.description])
      return
    }
    node.installTap(onBus: 0, bufferSize: Self.tapFrames, format: format) { [pipeline, weak self] buffer, when in
      let stampedAt = AVAudioTime.seconds(forHostTime: when.hostTime)
      self?.logTimingOnce(buffer, stampedAt: stampedAt)
      guard let converted = Self.convert(buffer, with: converter) else { return }
      pipeline.handleAudio(converted, firstFrameStamp: stampedAt)
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
      "stampBehindDeliveryMs": String(format: "%.1f", (HostClock.now() - stampedAt) * 1000),
      "inputLatencyMs": String(format: "%.1f", session.inputLatency * 1000),
      "ioBufferMs": String(format: "%.1f", session.ioBufferDuration * 1000),
    ])
  }

  private func logLifecycle(_ message: String, isPlayoutEnabled: Bool, isRecordingEnabled: Bool) {
    log.info("audio", message, ["playout": String(isPlayoutEnabled), "recording": String(isRecordingEnabled)])
  }

  private func removeTap() {
    state.withLock { $0.tapped }?.removeTap(onBus: 0)
    state.withLock { $0.tapped = nil }
  }

  private static func convert(_ buffer: AVAudioPCMBuffer, with converter: AVAudioConverter) -> AVAudioPCMBuffer? {
    let ratio = fileFormat.sampleRate / converter.inputFormat.sampleRate
    let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up)) + resamplerSlackFrames
    guard let output = AVAudioPCMBuffer(pcmFormat: fileFormat, frameCapacity: capacity) else { return nil }
    var delivered = false
    var error: NSError?
    converter.convert(to: output, error: &error) { _, status in
      if delivered {
        status.pointee = .noDataNow
        return nil
      }
      delivered = true
      status.pointee = .haveData
      return buffer
    }
    return error == nil && output.frameLength > 0 ? output : nil
  }
}
