import ExpoModulesCore

public final class BackgroundUploadModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BackgroundUpload")
    Events("onUploadChange")

    OnCreate { [self] in
      Task { @MainActor [weak self] in
        UploadEngine.shared.onChange = { self?.emit($0) }
        await UploadEngine.shared.activate()
      }
    }

    AsyncFunction("requestNotificationPermission") { () async throws -> Bool in
      try await UploadNotifier.requestPermission()
    }
    AsyncFunction("startUpload") { (input: [String: Any]) async throws -> [String: Any] in
      let decoded = try JSONDecoder().decode(StartUploadInput.self, from: JSONSerialization.data(withJSONObject: input))
      return try Self.object(await UploadEngine.shared.start(decoded))
    }
    AsyncFunction("getUploads") { () async throws -> [[String: Any]] in
      await UploadEngine.shared.activate()
      return try await UploadEngine.shared.snapshots().map(Self.object)
    }
    AsyncFunction("retryFailedParts") { (id: String) async throws in
      try await UploadEngine.shared.retryFailedParts(id: id)
    }
    AsyncFunction("cancelUpload") { (id: String) async throws in
      try await UploadEngine.shared.cancel(id: id)
    }
  }

  private func emit(_ snapshot: UploadSnapshot) {
    do {
      sendEvent("onUploadChange", try Self.object(snapshot))
    } catch {
      assertionFailure("UploadSnapshot must encode to a JSON object: \(error)")
    }
  }

  private static func object(_ snapshot: UploadSnapshot) throws -> [String: Any] {
    let json = try JSONSerialization.jsonObject(with: UploadCoding.encoder().encode(snapshot))
    return json as? [String: Any] ?? [:]
  }
}
