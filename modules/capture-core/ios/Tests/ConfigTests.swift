import Testing
@testable import CaptureCoreLogic

struct ConfigResolverTests {
  @Test func defaultsAreValid() {
    #expect(ConfigValidator.problems(in: .defaults).isEmpty)
  }

  @Test func emptyOverridesKeepDefaults() throws {
    #expect(try ConfigResolver.resolve(overrides: [:]) == .defaults)
  }

  @Test func nestedOverrideKeepsSiblings() throws {
    let config = try ConfigResolver.resolve(overrides: [
      "call": ["profiles": ["standard": ["fps": 24.0]]],
      "session": ["resumePolicy": "automatic"],
    ])
    #expect(config.call.profiles.standard == CallVideoProfile(width: 1280, height: 720, fps: 24))
    #expect(config.call.profiles.reduced == CaptureConfig.defaults.call.profiles.reduced)
    #expect(config.session.resumePolicy == .automatic)
    #expect(config.camera == CaptureConfig.defaults.camera)
  }

  @Test func unknownKeyIsRejected() {
    #expect(throws: ConfigError.unknownKey(path: "camera.zoom")) {
      try ConfigResolver.resolve(overrides: ["camera": ["zoom": 2.0]])
    }
  }

  @Test func wrongScalarTypeIsRejected() {
    #expect(throws: ConfigError.wrongType(path: "camera.fps", expected: "number")) {
      try ConfigResolver.resolve(overrides: ["camera": ["fps": "30"]])
    }
  }

  @Test func scalarInPlaceOfObjectIsRejected() {
    #expect(throws: ConfigError.wrongType(path: "camera", expected: "object")) {
      try ConfigResolver.resolve(overrides: ["camera": 5.0])
    }
  }

  @Test func booleanIsNotANumber() {
    #expect(throws: ConfigError.wrongType(path: "camera.fps", expected: "number")) {
      try ConfigResolver.resolve(overrides: ["camera": ["fps": true]])
    }
  }

  @Test(arguments: [Double.nan, .infinity, -.infinity])
  func nonFiniteNumberIsRejected(value: Double) {
    #expect(throws: ConfigError.wrongType(path: "camera.fps", expected: "number")) {
      try ConfigResolver.resolve(overrides: ["camera": ["fps": value]])
    }
  }

  @Test func unknownEnumValueIsRejected() {
    #expect(throws: (any Error).self) {
      try ConfigResolver.resolve(overrides: ["camera": ["position": "side"]])
    }
    do {
      _ = try ConfigResolver.resolve(overrides: ["camera": ["position": "side"]])
    } catch let ConfigError.undecodable(path, _) {
      #expect(path == "camera.position")
    } catch {
      Issue.record("unexpected error \(error)")
    }
  }

  @Test func fractionalIntegerIsRejected() {
    #expect(throws: (any Error).self) {
      try ConfigResolver.resolve(overrides: ["camera": ["fps": 29.97]])
    }
  }

  @Test func invalidValuesAreCollected() {
    #expect(throws: (any Error).self) {
      try ConfigResolver.resolve(overrides: ["camera": ["width": 1921.0], "recording": ["fragmentIntervalSec": 0.5]])
    }
  }
}

struct ConfigValidatorTests {
  private func problems(_ change: (inout CaptureConfig) -> Void) -> [String] {
    var config = CaptureConfig.defaults
    change(&config)
    return ConfigValidator.problems(in: config)
  }

  @Test func oddCameraSize() {
    #expect(problems { $0.camera.width = 1921 }.contains { $0.hasPrefix("camera size") })
  }

  @Test func fpsOutOfRange() {
    #expect(problems { $0.camera.fps = 0 }.contains { $0.hasPrefix("camera.fps") })
    #expect(problems { $0.camera.fps = 120 }.contains { $0.hasPrefix("camera.fps") })
  }

  @Test func callProfileLargerThanCamera() {
    #expect(problems { $0.call.profiles.standard = CallVideoProfile(width: 3840, height: 2160, fps: 30) }
      .contains { $0.hasPrefix("call.profiles.standard") })
  }

  @Test func callProfileFasterThanCamera() {
    #expect(problems { $0.call.profiles.minimal.fps = 60 }.contains { $0.hasPrefix("call.profiles.minimal.fps") })
  }

  @Test func fragmentShorterThanOneSecond() {
    #expect(problems { $0.recording.fragmentIntervalSec = 0.5 }.contains { $0.hasPrefix("recording.fragmentIntervalSec") })
  }

  @Test func fileStallMustExceedTwoFragments() {
    #expect(problems { $0.health.fileStallMs = 4000 }.contains { $0.hasPrefix("health.fileStallMs") })
  }

  @Test func micRestartGraceMustCoverTheAudioStall() {
    #expect(problems { $0.health.micRestartGraceMs = 400 }.contains { $0.hasPrefix("health.micRestartGraceMs") })
  }

  @Test func storageThresholdsMustBeOrdered() {
    #expect(problems { $0.storage.criticalFreeSpaceMB = 2000 }.contains { $0.hasPrefix("storage") })
  }

  @Test func connectTimeoutOutOfRange() {
    #expect(problems { $0.call.connectTimeoutSec = 2 }.contains { $0.hasPrefix("call.connectTimeoutSec") })
  }
}
