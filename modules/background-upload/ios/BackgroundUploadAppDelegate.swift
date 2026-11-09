import ExpoModulesCore

public final class BackgroundUploadAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    guard identifier == BackgroundTransferSession.identifier else {
      completionHandler()
      return
    }
    MainActor.assumeIsolated {
      UploadEngine.shared.handleBackgroundEvents(completionHandler: completionHandler)
    }
  }
}
