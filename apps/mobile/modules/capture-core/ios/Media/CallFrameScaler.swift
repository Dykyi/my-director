import CoreMedia
import VideoToolbox
import os
#if canImport(LiveKit)
import LiveKit
#else
import LiveKitClient
#endif

/// The file never waits for the call: a frame that arrives while the previous call frame is still in flight
/// is dropped for the call only.
final class CallFrameScaler: @unchecked Sendable {
  private static let failureLog = LogThrottle(every: 30)

  private struct Gate {
    var busy = false
    var pacer: FrameRatePacer
    var droppedFrames = 0
  }

  private let queue = DispatchQueue(label: "capture-core.call", qos: .userInitiated)
  private let gate: OSAllocatedUnfairLock<Gate>
  private let log: EventLog

  private var capturer: BufferCapturer?
  private var rotation = VideoRotation._90
  private var transfer: VTPixelTransferSession?
  private var pool: CVPixelBufferPool?
  private var scaleFailures = 0

  init(profile: CallVideoProfile, log: EventLog) {
    gate = OSAllocatedUnfairLock(initialState: Gate(pacer: FrameRatePacer(targetFps: Double(profile.fps))))
    self.log = log
    queue.async { self.prepare(profile) }
  }

  var droppedFrameCount: Int { gate.withLock { $0.droppedFrames } }

  func attach(_ capturer: BufferCapturer?, rotationAngle: Double) {
    let rotation = Self.videoRotation(forAngle: rotationAngle)
    queue.async {
      self.capturer = capturer
      self.rotation = rotation
    }
  }

  func apply(_ profile: CallVideoProfile) {
    gate.withLock { $0.pacer.retarget(fps: Double(profile.fps)) }
    queue.async { self.prepare(profile) }
  }

  func offer(_ sampleBuffer: CMSampleBuffer) {
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    let time = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
    let accepted = gate.withLock { gate -> Bool in
      if gate.busy {
        gate.droppedFrames += 1
        return false
      }
      guard gate.pacer.shouldSend(at: time.seconds) else { return false }
      gate.busy = true
      return true
    }
    guard accepted else { return }
    queue.async {
      defer { self.gate.withLock { $0.busy = false } }
      self.send(pixelBuffer, time: time)
    }
  }

  private func send(_ source: CVPixelBuffer, time: CMTime) {
    guard let capturer, let transfer, let pool else { return }
    var destination: CVPixelBuffer?
    guard CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &destination) == kCVReturnSuccess,
          let destination,
          VTPixelTransferSessionTransferImage(transfer, from: source, to: destination) == noErr
    else {
      scaleFailures += 1
      if Self.failureLog.allows(scaleFailures) {
        log.warning("call", "Scaling a call frame failed", ["count": String(scaleFailures)])
      }
      return
    }
    // BufferCapturer publishes frames at their own size; it never scales.
    capturer.capture(destination, timeStampNs: CMTimeConvertScale(time, timescale: nanosecondTimescale, method: .default).value, rotation: rotation)
  }

  private func prepare(_ profile: CallVideoProfile) {
    if transfer == nil {
      var session: VTPixelTransferSession?
      VTPixelTransferSessionCreate(allocator: kCFAllocatorDefault, pixelTransferSessionOut: &session)
      transfer = session
    }
    pool = Self.makePool(width: profile.width, height: profile.height)
    if transfer == nil || pool == nil {
      log.error("call", "Cannot prepare call frame scaling", ["profile": "\(profile.width)x\(profile.height)"])
    }
  }

  private static func makePool(width: Int, height: Int) -> CVPixelBufferPool? {
    let attributes: [String: Any] = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange,
      kCVPixelBufferWidthKey as String: width,
      kCVPixelBufferHeightKey as String: height,
      kCVPixelBufferIOSurfacePropertiesKey as String: [String: Any](),
    ]
    var pool: CVPixelBufferPool?
    CVPixelBufferPoolCreate(kCFAllocatorDefault, nil, attributes as CFDictionary, &pool)
    return pool
  }

  private static func videoRotation(forAngle angle: Double) -> VideoRotation {
    switch Int(angle.rounded()) % 360 {
    case 90: ._90
    case 180: ._180
    case 270: ._270
    default: ._0
    }
  }
}
