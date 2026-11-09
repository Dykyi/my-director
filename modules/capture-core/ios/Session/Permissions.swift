import AVFoundation

enum PermissionStatus: String, Codable, Sendable { case granted, denied, undetermined }

struct PermissionsState: Codable, Equatable, Sendable {
  var camera: PermissionStatus
  var microphone: PermissionStatus

  var allGranted: Bool { camera == .granted && microphone == .granted }
}

enum Permissions {
  static func current() -> PermissionsState {
    PermissionsState(camera: status(for: .video), microphone: status(for: .audio))
  }

  static func request() async -> PermissionsState {
    _ = await AVCaptureDevice.requestAccess(for: .video)
    _ = await AVCaptureDevice.requestAccess(for: .audio)
    return current()
  }

  private static func status(for mediaType: AVMediaType) -> PermissionStatus {
    switch AVCaptureDevice.authorizationStatus(for: mediaType) {
    case .authorized: .granted
    case .notDetermined: .undetermined
    default: .denied
    }
  }
}
