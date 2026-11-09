import AVFAudio

@MainActor
final class AudioRouteMonitor {
  private let log: EventLog
  private var observer: NSObjectProtocol?
  private(set) var current = AudioRoute.unknown

  nonisolated init(log: EventLog) {
    self.log = log
  }

  func start() {
    guard observer == nil else { return }
    let session = AVAudioSession.sharedInstance()
    current = AudioRoute(session.currentRoute)
    observer = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification, object: session, queue: .main
    ) { [weak self] notification in
      MainActor.assumeIsolated { self?.routeChanged(notification) }
    }
    log.info("audio", "Audio route", ["input": current.input, "output": current.output])
  }

  private func routeChanged(_ notification: Notification) {
    let rawReason = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
    let previous = notification.userInfo?[AVAudioSessionRouteChangePreviousRouteKey] as? AVAudioSessionRouteDescription
    let from = previous.map { AudioRoute($0) } ?? current
    current = AudioRoute(AVAudioSession.sharedInstance().currentRoute)
    log.info("audio", "Audio route changed", [
      "reason": rawReason.flatMap { AVAudioSession.RouteChangeReason(rawValue: $0) }.map(\.logName) ?? "missing",
      "fromInput": from.input,
      "toInput": current.input,
      "fromOutput": from.output,
      "toOutput": current.output,
    ])
  }
}

extension AudioRoute {
  init(_ route: AVAudioSessionRouteDescription) {
    self.init(
      inputs: route.inputs.map { Port(name: $0.portName, type: $0.portType.rawValue) },
      outputs: route.outputs.map { Port(name: $0.portName, type: $0.portType.rawValue) }
    )
  }
}

private extension AVAudioSession.RouteChangeReason {
  var logName: String {
    switch self {
    case .unknown: "unknown"
    case .newDeviceAvailable: "newDeviceAvailable"
    case .oldDeviceUnavailable: "oldDeviceUnavailable"
    case .categoryChange: "categoryChange"
    case .override: "override"
    case .wakeFromSleep: "wakeFromSleep"
    case .noSuitableRouteForCategory: "noSuitableRouteForCategory"
    case .routeConfigurationChange: "routeConfigurationChange"
    @unknown default: "unknown(\(rawValue))"
    }
  }
}
