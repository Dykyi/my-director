import AVFoundation
import ExpoModulesCore

final class CapturePreviewView: ExpoView {
  private let previewLayer = AVCaptureVideoPreviewLayer()
  private var startObserver: NSObjectProtocol?
  private var rotationCoordinator: AVCaptureDevice.RotationCoordinator?
  private var rotationObservation: NSKeyValueObservation?

  var gravity = PreviewGravity.aspectFill {
    didSet { previewLayer.videoGravity = gravity.layerGravity }
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    previewLayer.videoGravity = gravity.layerGravity
    layer.addSublayer(previewLayer)
    let module = appContext?.moduleRegistry.get(moduleWithName: CaptureCoreModule.moduleName) as? CaptureCoreModule
    let session = module?.captureSession
    previewLayer.session = session
    // The preview connection exists only once the session has its camera input.
    startObserver = NotificationCenter.default.addObserver(
      forName: AVCaptureSession.didStartRunningNotification,
      object: session,
      queue: .main
    ) { [weak self] _ in
      self?.followCameraRotation()
    }
    followCameraRotation()
  }

  deinit {
    if let startObserver { NotificationCenter.default.removeObserver(startObserver) }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer.frame = bounds
  }

  /// The angle follows how the sensor is mounted: landscape on earlier iPhones, portrait on the iPhone 17 front camera.
  private func followCameraRotation() {
    let inputs = previewLayer.session?.inputs.compactMap { $0 as? AVCaptureDeviceInput } ?? []
    guard let camera = inputs.first(where: { $0.device.hasMediaType(.video) })?.device else { return }
    let coordinator = AVCaptureDevice.RotationCoordinator(device: camera, previewLayer: previewLayer)
    rotationObservation = coordinator.observe(
      \.videoRotationAngleForHorizonLevelPreview,
      options: [.initial, .new]
    ) { [weak self] coordinator, _ in
      let angle = coordinator.videoRotationAngleForHorizonLevelPreview
      DispatchQueue.main.async { self?.applyRotation(angle) }
    }
    rotationCoordinator = coordinator
  }

  private func applyRotation(_ angle: CGFloat) {
    guard let connection = previewLayer.connection, connection.isVideoRotationAngleSupported(angle) else { return }
    connection.videoRotationAngle = angle
  }
}

enum PreviewGravity: String, Enumerable {
  case aspectFill, aspectFit

  var layerGravity: AVLayerVideoGravity {
    self == .aspectFill ? .resizeAspectFill : .resizeAspect
  }
}
