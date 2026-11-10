import AVFoundation
import CoreMediaIO

let phoneWaitSeconds = 10.0
let pollSeconds = 0.5

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data("record-screen: \(message)\n".utf8))
  exit(1)
}

func allowScreenCaptureDevices() {
  var address = CMIOObjectPropertyAddress(
    mSelector: CMIOObjectPropertySelector(kCMIOHardwarePropertyAllowScreenCaptureDevices),
    mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
    mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain)
  )
  var allow: UInt32 = 1
  let status = CMIOObjectSetPropertyData(
    CMIOObjectID(kCMIOObjectSystemObject), &address, 0, nil, UInt32(MemoryLayout<UInt32>.size), &allow
  )
  if status != 0 { fail("could not enable iOS screen capture (CoreMediaIO status \(status))") }
}

func waitForPhone() -> AVCaptureDevice {
  let deadline = Date().addingTimeInterval(phoneWaitSeconds)
  while Date() < deadline {
    let discovery = AVCaptureDevice.DiscoverySession(deviceTypes: [.external], mediaType: .muxed, position: .unspecified)
    if let phone = discovery.devices.first { return phone }
    RunLoop.current.run(until: Date().addingTimeInterval(pollSeconds))
  }
  fail("no iPhone screen found; connect the phone by cable, unlock it and trust this Mac")
}

func ensureCameraAccess() {
  switch AVCaptureDevice.authorizationStatus(for: .video) {
  case .authorized:
    return
  case .notDetermined:
    let answered = DispatchSemaphore(value: 0)
    var granted = false
    AVCaptureDevice.requestAccess(for: .video) { granted = $0; answered.signal() }
    answered.wait()
    if granted { return }
  default:
    break
  }
  fail("camera access is off for this terminal: System Settings > Privacy & Security > Camera")
}

final class Recorder: NSObject, AVCaptureFileOutputRecordingDelegate {
  private let session = AVCaptureSession()
  private let movie = AVCaptureMovieFileOutput()

  func start(_ phone: AVCaptureDevice, to url: URL) {
    do {
      let input = try AVCaptureDeviceInput(device: phone)
      guard session.canAddInput(input), session.canAddOutput(movie) else { fail("the capture session refused the phone") }
      session.addInput(input)
      session.addOutput(movie)
    } catch {
      fail("could not open \(phone.localizedName): \(error.localizedDescription)")
    }
    session.startRunning()
    movie.startRecording(to: url, recordingDelegate: self)
  }

  func stop() {
    movie.stopRecording()
  }

  func fileOutput(_ output: AVCaptureFileOutput, didStartRecordingTo url: URL, from connections: [AVCaptureConnection]) {
    print("recording \(url.path)")
  }

  func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo url: URL, from connections: [AVCaptureConnection], error: Error?) {
    session.stopRunning()
    if let error = error as NSError?, error.userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool != true {
      fail("recording failed: \(error.localizedDescription)")
    }
    print(String(format: "saved %@ (%.1f s)", url.path, output.recordedDuration.seconds))
    exit(0)
  }
}

setvbuf(stdout, nil, _IOLBF, 0)
guard CommandLine.arguments.count == 2 else { fail("usage: record-screen <output.mov>") }
let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
if FileManager.default.fileExists(atPath: outputURL.path) { fail("\(outputURL.path) exists; pick a new name") }

ensureCameraAccess()
allowScreenCaptureDevices()
let phone = waitForPhone()
print("found \(phone.localizedName)")

let recorder = Recorder()
var stopSignals: [DispatchSourceSignal] = []
for signalNumber in [SIGINT, SIGTERM] {
  signal(signalNumber, SIG_IGN)
  let source = DispatchSource.makeSignalSource(signal: signalNumber, queue: .main)
  source.setEventHandler { recorder.stop() }
  source.resume()
  stopSignals.append(source)
}
recorder.start(phone, to: outputURL)
RunLoop.main.run()
