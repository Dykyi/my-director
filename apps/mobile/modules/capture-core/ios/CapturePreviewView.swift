import AVFoundation
import ExpoModulesCore

final class CapturePreviewView: ExpoView {
  private let previewLayer = AVCaptureVideoPreviewLayer()
  private var startObserver: NSObjectProtocol?

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
      self?.applyPortraitRotation()
    }
    applyPortraitRotation()
  }

  deinit {
    if let startObserver { NotificationCenter.default.removeObserver(startObserver) }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer.frame = bounds
  }

  private func applyPortraitRotation() {
    guard let connection = previewLayer.connection,
          connection.isVideoRotationAngleSupported(CameraSource.portraitRotationAngle)
    else { return }
    connection.videoRotationAngle = CameraSource.portraitRotationAngle
  }
}

enum PreviewGravity: String, Enumerable {
  case aspectFill, aspectFit

  var layerGravity: AVLayerVideoGravity {
    self == .aspectFill ? .resizeAspectFill : .resizeAspect
  }
}
