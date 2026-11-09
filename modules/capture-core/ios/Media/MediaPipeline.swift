import AVFoundation
import os

protocol CallFrameSink: AnyObject, Sendable {
  func offer(_ sampleBuffer: CMSampleBuffer)
}

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
  var lastAudioArrival = 0.0
  var audioSampleRate = 0.0
  var audioBufferCount = 0
  var audioMaxGapMs = 0.0
  var audioDriftMs = 0.0
  var audioResyncCount = 0
}

final class MediaPipeline: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, @unchecked Sendable {
  static let defaultSampleRate = 48_000.0
  private static let nanosecondTimescale: CMTimeScale = 1_000_000_000
  private static let dropLogInterval = 30

  let queue = DispatchQueue(label: "capture-core.media", qos: .userInteractive)
  let heartbeats = HeartbeatBoard()
  private let stats = OSAllocatedUnfairLock(initialState: MediaStats())
  private let log: EventLog
  private let onWriterFailure: @Sendable (Failure) -> Void

  private var writer: SegmentWriter?
  private var callSink: CallFrameSink?
  private var captureClock: CMClock?
  private var reportedSampleRateMismatch = false

  init(log: EventLog, onWriterFailure: @escaping @Sendable (Failure) -> Void) {
    self.log = log
    self.onWriterFailure = onWriterFailure
  }

  var statsSnapshot: MediaStats { stats.withLock { $0 } }

  func setCaptureClock(_ clock: CMClock?) {
    queue.async { self.captureClock = clock }
  }

  func setCallSink(_ sink: CallFrameSink?) {
    queue.async { self.callSink = sink }
  }

  func segmentSettings(url: URL, config: CaptureConfig, rotationAngle: Double) -> SegmentWriter.Settings {
    let audioSession = AVAudioSession.sharedInstance()
    let sampleRate = statsSnapshot.audioSampleRate
    return SegmentWriter.Settings(
      url: url,
      camera: config.camera,
      recording: config.recording,
      rotationAngle: rotationAngle,
      audio: AudioTimeline.Configuration(
        sampleRate: sampleRate > 0 ? sampleRate : Self.defaultSampleRate,
        captureLatency: audioSession.inputLatency + audioSession.ioBufferDuration,
        resyncThreshold: config.audio.resyncThresholdMs / 1000
      )
    )
  }

  func openSegment(_ settings: SegmentWriter.Settings) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      queue.async {
        do {
          self.writer = try SegmentWriter(settings: settings)
          self.reportedSampleRateMismatch = false
          self.stats.withLock { stats in
            stats.fileRate.reset()
            stats.fileDroppedFrames = 0
            stats.cameraDroppedFrames = 0
            stats.segmentSec = 0
            stats.audioMaxGapMs = 0
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
    let writer: SegmentWriter? = await withCheckedContinuation { continuation in
      queue.async {
        let writer = self.writer
        self.writer = nil
        continuation.resume(returning: writer)
      }
    }
    guard let writer else { return nil }
    stats.withLock { $0.writerState = .finishing }
    let outcome = await writer.finish()
    stats.withLock { stats in
      if case .failed = outcome { stats.writerState = .failed } else { stats.writerState = .idle }
    }
    return outcome
  }

  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    let now = HostClock.now()
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
  }

  func captureOutput(_ output: AVCaptureOutput, didDrop sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    let count = stats.withLock { stats in
      stats.cameraDroppedFrames += 1
      return stats.cameraDroppedFrames
    }
    guard count == 1 || count.isMultiple(of: Self.dropLogInterval) else { return }
    let reason = CMGetAttachment(sampleBuffer, key: kCMSampleBufferAttachmentKey_DroppedFrameReason, attachmentModeOut: nil)
    log.warning("camera", "Camera dropped frames", ["count": String(count), "reason": reason.map { String(describing: $0) } ?? "unknown"])
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

  func handleAudio(_ buffer: AVAudioPCMBuffer, arrival: Double) {
    heartbeats.beat(.microphone, at: arrival)
    queue.async { self.processAudio(buffer, arrival: arrival) }
  }

  private func processAudio(_ buffer: AVAudioPCMBuffer, arrival: Double) {
    guard let channel = buffer.int16ChannelData?[0] else {
      log.error("audio", "Unexpected microphone buffer format", ["format": buffer.format.description])
      return
    }
    let samples = UnsafeBufferPointer(start: channel, count: Int(buffer.frameLength))
    let sampleRate = buffer.format.sampleRate
    let level = AudioLevel.rmsDb(samples)
    stats.withLock { stats in
      if stats.lastAudioArrival > 0 {
        stats.audioMaxGapMs = max(stats.audioMaxGapMs, (arrival - stats.lastAudioArrival) * 1000)
      }
      stats.audioLevelDb = level
      stats.lastAudioArrival = arrival
      stats.audioSampleRate = sampleRate
      stats.audioBufferCount += 1
    }
    guard let writer else { return }
    guard sampleRate == writer.audioSampleRate else {
      if !reportedSampleRateMismatch {
        reportedSampleRateMismatch = true
        log.error("audio", "Microphone sample rate changed inside a segment; audio is skipped until the next segment",
                  ["segmentRate": String(writer.audioSampleRate), "bufferRate": String(sampleRate)])
      }
      return
    }
    switch writer.appendAudio(samples, arrival: captureClockTime(arrival)) {
    case .appended:
      heartbeats.beat(.fileAudio, at: HostClock.now())
    case .skipped:
      break
    case .failed(let failure):
      reportWriterFailure(failure)
    }
    if let correction = writer.takeCorrection() {
      log.warning("audio", "Audio clock resynced", ["correctionMs": String(format: "%.1f", correction * 1000)])
    }
    stats.withLock { stats in
      stats.audioDriftMs = writer.audioDriftSec * 1000
      stats.audioResyncCount = writer.audioResyncCount
    }
  }

  private func captureClockTime(_ hostSeconds: Double) -> Double {
    guard let captureClock else { return hostSeconds }
    let hostTime = CMTime(seconds: hostSeconds, preferredTimescale: Self.nanosecondTimescale)
    return CMSyncConvertTime(hostTime, from: CMClockGetHostTimeClock(), to: captureClock).seconds
  }

  private func reportWriterFailure(_ failure: Failure) {
    stats.withLock { $0.writerState = .failed }
    log.error("writer", "Segment writer failed", ["message": failure.message])
    onWriterFailure(failure)
  }
}

extension HeartbeatBoard {
  private static let pollInterval = Duration.milliseconds(50)

  func waitForBeat(_ pipeline: Pipeline, after: Double, timeout: Double) async -> Bool {
    let deadline = HostClock.now() + timeout
    while HostClock.now() < deadline {
      if let beat = snapshot()[pipeline], beat > after { return true }
      try? await Task.sleep(for: Self.pollInterval)
    }
    return false
  }
}
