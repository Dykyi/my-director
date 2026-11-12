import AVFoundation
import ExpoModulesCore

public final class CaptureCoreModule: Module {
  static let moduleName = "CaptureCore"

  private struct RecoveryEvent: Encodable {
    var reports: [RecoveryReport]
  }

  /// One per process: a JS reload replaces the module, not the session it may be recording.
  private static let sharedController = SessionController()
  private var controller: SessionController { Self.sharedController }

  var captureSession: AVCaptureSession { controller.captureSession }

  public func definition() -> ModuleDefinition {
    Name(Self.moduleName)
    Events("onStateChange", "onHealth", "onLog", "onRecoveryFound")

    OnCreate { [self] in
      let controller = self.controller
      controller.log.setListener { [weak self] entry in self?.emit("onLog", entry) }
      Task { @MainActor [weak self] in
        controller.onSnapshot = { self?.emit("onStateChange", $0) }
        controller.onHealth = { self?.emit("onHealth", $0) }
        controller.onRecoveryFound = { self?.emit("onRecoveryFound", RecoveryEvent(reports: $0)) }
        await controller.activate()
      }
    }

    Function("getPermissions") { () throws -> [String: Any] in
      try JSONBridge.object(Permissions.current())
    }
    AsyncFunction("requestPermissions") { () async throws -> [String: Any] in
      try JSONBridge.object(await Permissions.request())
    }
    Function("getConfig") { () throws -> [String: Any] in
      try JSONBridge.object(self.controller.configCache.withLock { $0 })
    }
    Function("getSnapshot") { () throws -> [String: Any] in
      try JSONBridge.object(self.controller.snapshotCache.withLock { $0 })
    }

    AsyncFunction("prepare") { (overrides: [String: Any]?) async throws -> [String: Any] in
      try await self.command { controller in try JSONBridge.object(try await controller.prepare(overrides: overrides ?? [:])) }
    }
    AsyncFunction("start") { (url: String, token: String) async throws -> String in
      try await self.command { controller in try await controller.start(CallCredentials(url: url, token: token)) }
    }
    AsyncFunction("pause") { () async throws in
      try await self.command { controller in try await controller.pause() }
    }
    AsyncFunction("resume") { () async throws in
      try await self.command { controller in try await controller.resume() }
    }
    AsyncFunction("reconnectCall") { () async throws in
      try await self.command { controller in try await controller.reconnectCall() }
    }
    AsyncFunction("setCallName") { (name: String) async throws in
      try await self.command { controller in try await controller.setCallName(name) }
    }
    AsyncFunction("stop") { () async throws -> [String: Any] in
      try await self.command { controller in try JSONBridge.object(try await controller.stop()) }
    }
    AsyncFunction("dismissError") { () async in
      await self.controller.dismissError()
    }

    AsyncFunction("listRecordings") { () async throws -> [[String: Any]] in
      try await self.command { controller in try JSONBridge.array(await controller.listRecordings()) }
    }
    AsyncFunction("getRecoveryReports") { () async throws -> [[String: Any]] in
      try await self.command { controller in try JSONBridge.array(controller.recoveryReports) }
    }
    AsyncFunction("acknowledgeRecovery") { (sessionId: String) async throws in
      try await self.command { controller in try controller.acknowledgeRecovery(sessionId: sessionId) }
    }
    AsyncFunction("verifyRecording") { (sessionId: String) async throws -> [String: Any] in
      try await self.command { controller in try JSONBridge.object(try await controller.verifyRecording(sessionId: sessionId)) }
    }
    AsyncFunction("deleteRecording") { (sessionId: String) async throws in
      try await self.command { controller in try controller.deleteRecording(sessionId: sessionId) }
    }

    Function("simulateCrash") {
      // No lifecycle callback gets a chance to close the segment.
      kill(getpid(), SIGKILL)
    }

    View(CapturePreviewView.self) {
      Prop("videoGravity") { (view: CapturePreviewView, gravity: PreviewGravity) in
        view.gravity = gravity
      }
    }
  }

  private func command<T>(_ body: @MainActor (SessionController) async throws -> T) async throws -> T {
    let controller = controller
    do {
      return try await body(controller)
    } catch {
      throw CaptureException(Failure(error, fallback: .invalidState))
    }
  }

  private func emit(_ event: String, _ payload: some Encodable) {
    do {
      sendEvent(event, try JSONBridge.object(payload))
    } catch {
      controller.log.error("bridge", "Event encoding failed", ["event": event, "error": "\(error)"])
    }
  }
}
