import ExpoModulesCore
#if canImport(LiveKit)
import LiveKit
#else
import LiveKitClient
#endif

public final class CaptureCoreModule: Module {
  private var debugRoom: Room?

  public func definition() -> ModuleDefinition {
    Name("CaptureCore")

    AsyncFunction("debugConnect") { (url: String, token: String) async throws -> [String] in
      let room = Room()
      try await room.connect(url: url, token: token)
      try await room.localParticipant.setMicrophone(enabled: true)
      self.debugRoom = room
      return room.remoteParticipants.values.compactMap { $0.identity?.stringValue }
    }

    AsyncFunction("debugDisconnect") { () async in
      await self.debugRoom?.disconnect()
      self.debugRoom = nil
    }
  }
}
