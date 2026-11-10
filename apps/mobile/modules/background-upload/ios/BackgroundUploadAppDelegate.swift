import ExpoModulesCore

public final class BackgroundUploadAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    // Expo waits for every subscriber's handler before calling the system one, so foreign sessions answer at once.
    guard identifier == BackgroundTransferSession.identifier else {
      completionHandler()
      return
    }
    MainActor.assumeIsolated {
      UploadEngine.shared.handleBackgroundEvents(completionHandler: completionHandler)
    }
  }
}
