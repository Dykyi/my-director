import AVFoundation
import CallKit
import UIKit

@MainActor
final class SystemEventMonitor: NSObject, CXCallObserverDelegate {
  enum Event {
    case session(SessionEvent)
    case thermalChanged
    case mediaServicesReset
  }

  private let log: EventLog
  private let camera: CameraSource
  private let onEvent: @MainActor @Sendable (Event) -> Void
  private let callObserver = CXCallObserver()
  private var observers: [NSObjectProtocol] = []
  private var pressureObservation: NSKeyValueObservation?
  private var backgroundedAt: Double?
  private(set) var systemPressure = SystemPressureLevel.nominal

  nonisolated init(log: EventLog, camera: CameraSource, onEvent: @escaping @MainActor @Sendable (Event) -> Void) {
    self.log = log
    self.camera = camera
    self.onEvent = onEvent
    super.init()
  }

  func start() {
    let audioSession = AVAudioSession.sharedInstance()
    observe(AVAudioSession.interruptionNotification, object: audioSession) { [weak self] in self?.audioInterruption($0) }
    observe(AVAudioSession.mediaServicesWereResetNotification, object: audioSession) { [weak self] _ in
      self?.log.error("system", "Media services were reset")
      self?.onEvent(.mediaServicesReset)
    }
    observe(AVCaptureSession.wasInterruptedNotification, object: camera.session) { [weak self] in self?.cameraInterrupted($0) }
    observe(AVCaptureSession.interruptionEndedNotification, object: camera.session) { [weak self] _ in
      self?.log.info("system", "Camera interruption ended")
      self?.onEvent(.session(.interruptionEnded(.camera)))
    }
    observe(AVCaptureSession.runtimeErrorNotification, object: camera.session) { [weak self] notification in
      let error = notification.userInfo?[AVCaptureSessionErrorKey] as? NSError
      let message = "Camera runtime error \(error?.code ?? 0): \(error?.localizedDescription ?? "unknown")"
      self?.log.error("system", message)
      self?.onEvent(.session(.failure(Failure(code: .cameraRuntimeError, message: message), pauseReason: .cameraError)))
    }
    observe(UIApplication.didEnterBackgroundNotification) { [weak self] _ in self?.enteredBackground() }
    observe(UIApplication.willEnterForegroundNotification) { [weak self] _ in self?.enteringForeground() }
    observe(UIApplication.didBecomeActiveNotification) { [weak self] _ in
      self?.onEvent(.session(.appBecameActive))
    }
    observe(UIApplication.protectedDataWillBecomeUnavailableNotification) { [weak self] _ in
      self?.log.info("system", "Screen locked")
      self?.onEvent(.session(.screenLocked))
    }
    observe(ProcessInfo.thermalStateDidChangeNotification) { [weak self] _ in self?.onEvent(.thermalChanged) }
    observe(Notification.Name.NSProcessInfoPowerStateDidChange) { [weak self] _ in
      self?.log.warning("system", "Low Power Mode changed", ["enabled": String(ProcessInfo.processInfo.isLowPowerModeEnabled)])
    }
    callObserver.setDelegate(self, queue: .main)
  }

  func observeSystemPressure(of device: AVCaptureDevice?) {
    pressureObservation = device?.observe(\.systemPressureState, options: [.initial, .new]) { [weak self] device, _ in
      let level = SystemPressureLevel(device.systemPressureState.level)
      let factors = String(describing: device.systemPressureState.factors)
      Task { @MainActor in
        guard let self, level != self.systemPressure else { return }
        self.systemPressure = level
        self.log.log(level == .nominal ? .info : .warning, "system", "Camera system pressure changed", ["level": level.rawValue, "factors": factors])
      }
    }
  }

  nonisolated func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
    let state = call.hasEnded ? "ended" : call.hasConnected ? "connected" : call.isOutgoing ? "dialing" : "ringing"
    Task { @MainActor in self.log.info("system", "Phone call \(state)") }
  }

  private func audioInterruption(_ notification: Notification) {
    guard let info = notification.userInfo,
          let rawType = info[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: rawType)
    else { return }
    switch type {
    case .began:
      let reason = info[AVAudioSessionInterruptionReasonKey] as? UInt
      let phoneCall = callObserver.calls.contains { !$0.hasEnded }
      log.warning("system", "Audio interruption began", ["reason": reason.map(String.init) ?? "none", "phoneCall": String(phoneCall)])
      onEvent(.session(.interruptionBegan(.audioSession, phoneCall ? .phoneCall : .audioInterrupted)))
    case .ended:
      let options = AVAudioSession.InterruptionOptions(rawValue: info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0)
      log.info("system", "Audio interruption ended", ["shouldResume": String(options.contains(.shouldResume))])
      onEvent(.session(.interruptionEnded(.audioSession)))
    @unknown default:
      log.warning("system", "Unknown audio interruption type", ["type": String(rawType)])
    }
  }

  private func cameraInterrupted(_ notification: Notification) {
    let rawReason = notification.userInfo?[AVCaptureSessionInterruptionReasonKey] as? Int
    let reason = rawReason.flatMap(AVCaptureSession.InterruptionReason.init).map { "\($0)" } ?? "unknown"
    var data = ["reason": reason, "rawReason": rawReason.map(String.init) ?? "?"]
    if let backgroundedAt { data["msAfterBackground"] = String(Int((HostClock.now() - backgroundedAt) * 1000)) }
    log.warning("system", "Camera interrupted", data)
    onEvent(.session(.interruptionBegan(.camera, .cameraInterrupted)))
  }

  private func enteredBackground() {
    backgroundedAt = HostClock.now()
    log.info("system", "App entered background", [
      "multitaskingCameraAccessEnabled": String(camera.session.isMultitaskingCameraAccessEnabled),
    ])
    onEvent(.session(.interruptionBegan(.appBackground, .appBackground)))
  }

  private func enteringForeground() {
    let seconds = backgroundedAt.map { HostClock.now() - $0 } ?? 0
    backgroundedAt = nil
    log.info("system", "App entering foreground", ["backgroundSec": String(format: "%.1f", seconds)])
    onEvent(.session(.interruptionEnded(.appBackground)))
  }

  private func observe(_ name: Notification.Name, object: Any? = nil, handler: @escaping (Notification) -> Void) {
    observers.append(NotificationCenter.default.addObserver(forName: name, object: object, queue: .main) { notification in
      MainActor.assumeIsolated { handler(notification) }
    })
  }
}

extension ThermalLevel {
  init(_ state: ProcessInfo.ThermalState) {
    switch state {
    case .nominal: self = .nominal
    case .fair: self = .fair
    case .serious: self = .serious
    case .critical: self = .critical
    @unknown default: self = .critical
    }
  }
}

extension SystemPressureLevel {
  init(_ level: AVCaptureDevice.SystemPressureState.Level) {
    switch level {
    case .nominal: self = .nominal
    case .fair: self = .fair
    case .serious: self = .serious
    case .critical: self = .critical
    case .shutdown: self = .shutdown
    default: self = .critical
    }
  }
}
