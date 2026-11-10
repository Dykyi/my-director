import AVFoundation

struct CameraReport: Sendable {
  var position: CameraPosition
  var format: String
  var binned: Bool
  var hdrSupported: Bool
  var multitaskingCameraAccessSupported: Bool

  var logData: [String: String] {
    [
      "position": position.rawValue,
      "format": format,
      "binned": String(binned),
      "hdrSupported": String(hdrSupported),
      "multitaskingCameraAccess": String(multitaskingCameraAccessSupported),
    ]
  }
}

final class CameraSource: @unchecked Sendable {
  static let portraitRotationAngle = 90.0

  let session = AVCaptureSession()
  private let queue = DispatchQueue(label: "capture-core.camera", qos: .userInitiated)
  private let output = AVCaptureVideoDataOutput()
  private(set) var device: AVCaptureDevice?
  private var rotationCoordinator: AVCaptureDevice.RotationCoordinator?

  var isRunning: Bool { session.isRunning }
  var synchronizationClock: CMClock? { session.synchronizationClock }

  var captureRotationAngle: Double {
    rotationCoordinator.map { Double($0.videoRotationAngleForHorizonLevelCapture) } ?? Self.portraitRotationAngle
  }

  func configure(
    _ camera: CaptureConfig.Camera,
    frames delegate: AVCaptureVideoDataOutputSampleBufferDelegate & Sendable,
    on delegateQueue: DispatchQueue
  ) async throws -> CameraReport {
    try await withCheckedThrowingContinuation { continuation in
      queue.async {
        continuation.resume(with: Result { try self.configureSession(camera, delegate: delegate, delegateQueue: delegateQueue) })
      }
    }
  }

  func start() async {
    await withCheckedContinuation { continuation in
      queue.async {
        if !self.session.isRunning { self.session.startRunning() }
        continuation.resume()
      }
    }
  }

  func stop() async {
    await withCheckedContinuation { continuation in
      queue.async {
        if self.session.isRunning { self.session.stopRunning() }
        continuation.resume()
      }
    }
  }

  private func configureSession(
    _ camera: CaptureConfig.Camera,
    delegate: AVCaptureVideoDataOutputSampleBufferDelegate,
    delegateQueue: DispatchQueue
  ) throws -> CameraReport {
    let position: AVCaptureDevice.Position = camera.position == .front ? .front : .back
    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position) else {
      throw Failure(code: .cameraUnavailable, message: "No \(camera.position.rawValue) wide-angle camera")
    }
    guard let format = Self.bestFormat(of: device, for: camera) else {
      throw Failure(
        code: .cameraFormatUnsupported,
        message: "No \(camera.width)x\(camera.height)@\(camera.fps) 420f format; available: \(Self.availableSizes(of: device))"
      )
    }
    let input: AVCaptureDeviceInput
    do {
      input = try AVCaptureDeviceInput(device: device)
    } catch {
      throw Failure(code: .cameraUnavailable, message: error.localizedDescription)
    }

    session.beginConfiguration()
    defer { session.commitConfiguration() }
    session.inputs.forEach(session.removeInput)
    session.outputs.forEach(session.removeOutput)
    session.sessionPreset = .inputPriority
    session.automaticallyConfiguresApplicationAudioSession = false
    guard session.canAddInput(input) else {
      throw Failure(code: .cameraUnavailable, message: "The capture session rejected the camera input")
    }
    session.addInput(input)

    do {
      try device.lockForConfiguration()
    } catch {
      throw Failure(code: .cameraUnavailable, message: error.localizedDescription)
    }
    device.activeFormat = format
    let frameDuration = CMTime(value: 1, timescale: CMTimeScale(camera.fps))
    device.activeVideoMinFrameDuration = frameDuration
    device.activeVideoMaxFrameDuration = frameDuration
    if format.isVideoHDRSupported {
      device.automaticallyAdjustsVideoHDREnabled = false
      device.isVideoHDREnabled = false
    }
    device.unlockForConfiguration()

    output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange]
    output.alwaysDiscardsLateVideoFrames = true
    output.setSampleBufferDelegate(delegate, queue: delegateQueue)
    guard session.canAddOutput(output) else {
      throw Failure(code: .cameraUnavailable, message: "The capture session rejected the video output")
    }
    session.addOutput(output)
    if let connection = output.connection(with: .video) {
      if connection.isVideoStabilizationSupported {
        connection.preferredVideoStabilizationMode = camera.stabilization == .standard ? .standard : .off
      }
      if connection.isVideoMirroringSupported {
        connection.automaticallyAdjustsVideoMirroring = false
        connection.isVideoMirrored = false
      }
      if connection.isVideoRotationAngleSupported(0) { connection.videoRotationAngle = 0 }
    }
    self.device = device
    rotationCoordinator = AVCaptureDevice.RotationCoordinator(device: device, previewLayer: nil)

    return CameraReport(
      position: camera.position,
      format: Self.describe(format),
      binned: format.isVideoBinned,
      hdrSupported: format.isVideoHDRSupported,
      multitaskingCameraAccessSupported: session.isMultitaskingCameraAccessSupported
    )
  }

  static func bestFormat(of device: AVCaptureDevice, for camera: CaptureConfig.Camera) -> AVCaptureDevice.Format? {
    let fps = Double(camera.fps)
    return device.formats
      .filter { format in
        let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
        return Int(dimensions.width) == camera.width
          && Int(dimensions.height) == camera.height
          && CMFormatDescriptionGetMediaSubType(format.formatDescription) == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange
          && format.videoSupportedFrameRateRanges.contains { $0.minFrameRate <= fps && fps <= $0.maxFrameRate }
      }
      .min { lhs, rhs in
        if lhs.isVideoBinned != rhs.isVideoBinned { return !lhs.isVideoBinned }
        return maxFrameRate(of: lhs) < maxFrameRate(of: rhs)
      }
  }

  private static func maxFrameRate(of format: AVCaptureDevice.Format) -> Double {
    format.videoSupportedFrameRateRanges.map(\.maxFrameRate).max() ?? 0
  }

  private static func describe(_ format: AVCaptureDevice.Format) -> String {
    let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
    return "\(dimensions.width)x\(dimensions.height) 420f up to \(Int(maxFrameRate(of: format))) fps"
  }

  private static func availableSizes(of device: AVCaptureDevice) -> String {
    Set(device.formats.map { format in
      let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
      return "\(dimensions.width)x\(dimensions.height)"
    }).sorted().joined(separator: ", ")
  }
}
