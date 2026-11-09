import AVFoundation
import ExpoModulesCore

public final class CaptureCoreModule: Module {
  static let moduleName = "CaptureCore"

  private lazy var harness = DebugHarness()

  var captureSession: AVCaptureSession { harness.camera.session }

  public func definition() -> ModuleDefinition {
    Name(Self.moduleName)
    Events("onLog")

    OnCreate { [self] in
      self.harness.log.setListener { [weak self] entry in
        guard let payload = try? JSONBridge.object(entry) else { return }
        self?.sendEvent("onLog", payload)
      }
    }

    AsyncFunction("requestPermissions") { () async throws -> [String: Any] in
      try JSONBridge.object(await Permissions.request())
    }
    AsyncFunction("debugStartCamera") { () async throws -> [String: String] in
      try await self.harness.startCamera()
    }
    AsyncFunction("debugStartSegment") { () async throws -> String in
      try await self.harness.startSegment()
    }
    AsyncFunction("debugStopSegment") { () async -> String in
      await self.harness.stopSegment()
    }
    AsyncFunction("debugStats") { () async -> [String: String] in
      await self.harness.stats()
    }

    View(CapturePreviewView.self) {
      Prop("videoGravity") { (view: CapturePreviewView, gravity: PreviewGravity) in
        view.gravity = gravity
      }
    }
  }
}
