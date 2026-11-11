import AVFoundation
import os

/// Feeds every camera frame to the file first, then to the call. Writer state lives on `queue`;
/// stats and heartbeats are readable from any thread.
final class MediaPipeline: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, @unchecked Sendable {
  private static let dropLog = LogThrottle(every: 30)
  /// Audio comes in 100 ms tap chunks after it is captured, so the last one lands after the last frame.
  private static let audioDrainTimeoutSec = 0.3
  private static let audioDrainPoll = Duration.milliseconds(20)

  let queue = DispatchQueue(label: "capture-core.media", qos: .userInteractive)
  let heartbeats = HeartbeatBoard()
  private let stats = OSAllocatedUnfairLock(initialState: MediaStats())
  private let log: EventLog
  private let onWriterFailure: @Sendable (Failure) -> Void

  private var writer: SegmentWriter?
  private var callSink: CallFrameScaler?
  private var captureClock: CMClock?
  private var holeProbe = FrameHoleProbe()
  private var callFormat: AVAudioFormat?
  private var callResampler: PCMResampler?
  private var playoutLatency = 0.0
  private var routeObserver: NSObjectProtocol?

  init(log: EventLog, onWriterFailure: @escaping @Sendable (Failure) -> Void) {
    self.log = log
    self.onWriterFailure = onWriterFailure
    super.init()
    // A Bluetooth output plays the call 150 to 200 ms later than the speaker.
    routeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification, object: nil, queue: nil
    ) { [weak self] _ in self?.refreshPlayoutLatency() }
  }

  var statsSnapshot: MediaStats { stats.withLock { $0 } }

  func setCaptureClock(_ clock: CMClock?) {
    queue.async { self.captureClock = clock }
  }

  func setCallSink(_ sink: CallFrameScaler?) {
    queue.async { self.callSink = sink }
  }

  func segmentSettings(url: URL, config: CaptureConfig, rotationAngle: Double) -> SegmentWriter.Settings {
    let audioSession = AVAudioSession.sharedInstance()
    let sampleRate = PCMResampler.fileFormat.sampleRate
    refreshPlayoutLatency()
    return SegmentWriter.Settings(
      url: url,
      camera: config.camera,
      recording: config.recording,
      rotationAngle: rotationAngle,
      audio: AudioTimeline.Configuration(
        sampleRate: sampleRate,
        inputLatency: audioSession.inputLatency,
        ioBufferDuration: audioSession.ioBufferDuration,
        resyncThreshold: config.audio.resyncThresholdSec
      ),
      callMix: config.audio.mixCallAudio
        ? CallAudioMix(sampleRate: sampleRate, resyncThreshold: config.audio.resyncThresholdSec, gainDb: config.audio.callAudioGainDb)
        : nil
    )
  }

  func openSegment(_ settings: SegmentWriter.Settings) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      queue.async {
        do {
          self.writer = try SegmentWriter(settings: settings)
          self.stats.withLock { stats in
            stats.fileRate.reset()
            stats.fileDroppedFrames = 0
            stats.cameraDroppedFrames = 0
            stats.segmentSec = 0
            stats.writerState = .writing
          }
          continuation.resume()
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }

  func closeSegment() async -> SegmentOutcome? {
    let writer: SegmentWriter? = await onQueue {
      self.writer?.stopVideo()
      return self.writer
    }
    guard let writer else { return nil }
    stats.withLock { $0.writerState = .finishing }
    _ = try? await poll(every: Self.audioDrainPoll, timeout: Self.audioDrainTimeoutSec) {
      await self.onQueue { writer.audioCoversVideo }
    }
    await onQueue { self.writer = nil }
    let outcome = await writer.finish()
    if let summary = writer.callMixSummary { log.info("audio", "Call audio summary", summary.logData) }
    stats.withLock { stats in
      if case .failed = outcome { stats.writerState = .failed } else { stats.writerState = .idle }
      // The manifest takes over the closed segment's length. Left here, it would show on the timer until the next
      // segment opens, which happens just after the phase is already `recording`.
      stats.segmentSec = 0
    }
    return outcome
  }

  private func onQueue<T>(_ work: @escaping () -> T) async -> T {
    await withCheckedContinuation { continuation in
      queue.async { continuation.resume(returning: work()) }
    }
  }

  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    let now = HostClock.now()
    reportHole(before: sampleBuffer, arrivedAt: now)
    heartbeats.beat(.camera, at: now)
    let dimensions = CMSampleBufferGetFormatDescription(sampleBuffer).map(CMVideoFormatDescriptionGetDimensions)
    stats.withLock { stats in
      stats.cameraRate.tick(at: now)
      if let dimensions {
        stats.cameraWidth = Int(dimensions.width)
        stats.cameraHeight = Int(dimensions.height)
      }
    }
    if let writer { appendVideo(sampleBuffer, to: writer, at: now) }
    callSink?.offer(sampleBuffer)
    holeProbe.worked("video", for: HostClock.now() - now)
  }

  func captureOutput(_ output: AVCaptureOutput, didDrop sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    let reason = CMGetAttachment(sampleBuffer, key: kCMSampleBufferAttachmentKey_DroppedFrameReason, attachmentModeOut: nil)
      .map { String(describing: $0) } ?? "unknown"
    holeProbe.dropped(reason: reason)
    let count = stats.withLock { stats in
      stats.cameraDroppedFrames += 1
      return stats.cameraDroppedFrames
    }
    guard Self.dropLog.allows(count) else { return }
    log.warning("camera", "Camera dropped frames", ["count": String(count), "reason": reason])
  }

  private func reportHole(before sampleBuffer: CMSampleBuffer, arrivedAt now: Double) {
    let time = hostTime(CMSampleBufferGetPresentationTimeStamp(sampleBuffer))
    guard let hole = holeProbe.frame(at: time, arrivalLag: now - time), writer != nil else { return }
    log.warning("camera", "Camera frames missing", hole.logData)
  }

  private func appendVideo(_ sampleBuffer: CMSampleBuffer, to writer: SegmentWriter, at now: Double) {
    switch writer.appendVideo(sampleBuffer) {
    case .appended:
      heartbeats.beat(.fileVideo, at: now)
      stats.withLock { stats in
        stats.fileRate.tick(at: now)
        stats.segmentSec = writer.writtenSec
      }
    case .skipped:
      stats.withLock { $0.fileDroppedFrames = writer.droppedVideoFrames }
    case .failed(let failure):
      reportWriterFailure(failure)
    }
  }

  func handleAudio(_ buffer: AVAudioPCMBuffer, firstFrameHostTime: Double) {
    heartbeats.beat(.microphone, at: firstFrameHostTime)
    queue.async { self.processAudio(buffer, firstFrameHostTime: firstFrameHostTime) }
  }

  private func processAudio(_ buffer: AVAudioPCMBuffer, firstFrameHostTime: Double) {
    let started = HostClock.now()
    defer { holeProbe.worked("audio", for: HostClock.now() - started) }
    guard let channel = buffer.int16ChannelData?[0] else {
      log.error("audio", "Unexpected microphone buffer format", ["format": buffer.format.description])
      return
    }
    let samples = UnsafeBufferPointer(start: channel, count: Int(buffer.frameLength))
    let sampleRate = buffer.format.sampleRate
    let level = AudioLevel.rmsDb(samples)
    stats.withLock { stats in
      stats.audioLevelDb = level
      stats.lastAudioHostTime = firstFrameHostTime
      stats.audioSampleRate = sampleRate
    }
    guard let writer else { return }
    switch writer.appendAudio(samples, firstFrameCaptureTime: captureClockTime(firstFrameHostTime)) {
    case .appended:
      heartbeats.beat(.fileAudio, at: HostClock.now())
    case .skipped:
      break
    case .failed(let failure):
      reportWriterFailure(failure)
    }
    if let correction = writer.takeCorrection() {
      log.warning("audio", "Audio clock resynced", ["correctionMs": (correction * 1000).oneDecimal])
    }
    stats.withLock { stats in
      stats.audioDriftMs = writer.audioDriftSec * 1000
      stats.audioResyncCount = writer.audioResyncCount
    }
  }

  func handleCallAudio(_ buffer: AVAudioPCMBuffer, renderedAt: Double) {
    queue.async { self.processCallAudio(buffer, renderedAt: renderedAt) }
  }

  private func processCallAudio(_ buffer: AVAudioPCMBuffer, renderedAt: Double) {
    if callFormat != buffer.format {
      callFormat = buffer.format
      callResampler = PCMResampler(from: buffer.format)
      if callResampler == nil { log.error("audio", "Call audio format has no converter", ["format": buffer.format.description]) }
    }
    guard let converted = callResampler?.convert(buffer), let channel = converted.int16ChannelData?[0] else { return }
    let samples = UnsafeBufferPointer(start: channel, count: Int(converted.frameLength))
    stats.withLock { stats in
      stats.callAudioLevelDb = AudioLevel.rmsDb(samples)
      stats.lastCallAudioHostTime = renderedAt
    }
    guard let writer else { return }
    let wasSilent = !writer.hasCallAudio
    if let correction = writer.appendCallAudio(samples, playsAt: captureClockTime(renderedAt) + playoutLatency) {
      log.warning("audio", "Call audio clock resynced", ["correctionMs": (correction * 1000).oneDecimal])
    }
    guard wasSilent, writer.hasCallAudio else { return }
    log.info("audio", "Call audio mixed in", [
      "format": "\(Int(buffer.format.sampleRate)) Hz, \(buffer.format.channelCount) ch",
      "frames": String(buffer.frameLength),
      "playoutLatencyMs": (playoutLatency * 1000).oneDecimal,
    ])
  }

  private func refreshPlayoutLatency() {
    let session = AVAudioSession.sharedInstance()
    let latency = session.outputLatency + session.ioBufferDuration
    queue.async { self.playoutLatency = latency }
  }

  /// Audio arrives stamped with the host clock; video timestamps use the capture session's clock.
  private func captureClockTime(_ hostSeconds: Double) -> Double {
    guard let captureClock else { return hostSeconds }
    let hostTime = CMTime(seconds: hostSeconds, preferredTimescale: nanosecondTimescale)
    return CMSyncConvertTime(hostTime, from: CMClockGetHostTimeClock(), to: captureClock).seconds
  }

  private func hostTime(_ captureTime: CMTime) -> Double {
    guard let captureClock else { return captureTime.seconds }
    return CMSyncConvertTime(captureTime, from: captureClock, to: CMClockGetHostTimeClock()).seconds
  }

  private func reportWriterFailure(_ failure: Failure) {
    stats.withLock { $0.writerState = .failed }
    log.error("writer", "Segment writer failed", ["message": failure.message])
    onWriterFailure(failure)
  }
}
