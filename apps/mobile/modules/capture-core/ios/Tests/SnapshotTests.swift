import Foundation
import Testing
@testable import CaptureCoreLogic

struct SnapshotTests {
  private static let date = Date(timeIntervalSince1970: 1_800_000_000.125)

  @Test func sessionSnapshotSortsInterruptionsAndWarnings() {
    var state = SessionState()
    state.phase = .paused
    state.interruptions = [.camera, .appBackground]
    state.warnings = [
      .diskSpaceLow: CaptureWarning(code: .diskSpaceLow, message: "low", since: Self.date.addingTimeInterval(5)),
      .callDisconnected: CaptureWarning(code: .callDisconnected, message: "call", since: Self.date),
    ]
    let snapshot = SessionSnapshot(state: state, recordedSec: 12.5)
    #expect(snapshot.activeInterruptions == [.appBackground, .camera])
    #expect(snapshot.warnings.map(\.code) == [.callDisconnected, .diskSpaceLow])
  }

  @Test func warningsRaisedTogetherHaveAStableOrder() {
    var state = SessionState()
    let codes: [CaptureErrorCode] = [.fileWriterFailed, .fileFpsLow, .diskSpaceLow, .callDisconnected, .audioStalled]
    state.warnings = Dictionary(uniqueKeysWithValues: codes.map { ($0, CaptureWarning(code: $0, message: "", since: Self.date)) })
    let snapshot = SessionSnapshot(state: state, recordedSec: 0)
    #expect(snapshot.warnings.map(\.code) == [.audioStalled, .callDisconnected, .diskSpaceLow, .fileFpsLow, .fileWriterFailed])
  }

  @Test func bridgeProducesPlainDictionaries() throws {
    var state = SessionState()
    state.error = CaptureError(Failure(code: .micUnavailable, message: "busy"), at: Self.date)
    let object = try JSONBridge.object(SessionSnapshot(state: state, recordedSec: 0))
    #expect(object["phase"] as? String == "idle")
    #expect(object["sessionId"] == nil)
    let error = try #require(object["error"] as? [String: Any])
    #expect(error["code"] as? String == "micUnavailable")
    #expect(error["at"] as? String == "2027-01-15T08:00:00.125Z")
  }

  private static func participant(_ identity: String, joinedAt: Date?) -> ParticipantStatus {
    ParticipantStatus(identity: identity, joinedAt: joinedAt, quality: .excellent, isSpeaking: false, microphone: .live, camera: .none)
  }

  @Test func participantsComeEarliestFirst() {
    let ordered = ParticipantStatus.ordered([
      Self.participant("agent", joinedAt: nil),
      Self.participant("producer", joinedAt: Self.date.addingTimeInterval(60)),
      Self.participant("interviewer", joinedAt: Self.date),
    ])
    #expect(ordered.map(\.identity) == ["interviewer", "producer", "agent"])
  }

  @Test(arguments: [(Bool?.none, TrackStatus.none), (false, .live), (true, .muted)])
  func trackStatusFollowsPublicationAndMute(isMuted: Bool?, expected: TrackStatus) {
    #expect(TrackStatus(isMuted: isMuted) == expected)
  }

  @Test func bridgeCarriesParticipants() throws {
    var state = SessionState()
    state.call = CallStatus(
      state: .connected, room: "mydirector-poc", identity: "iphone", connectedAt: Self.date,
      participants: [Self.participant("interviewer", joinedAt: Self.date)]
    )
    let object = try JSONBridge.object(SessionSnapshot(state: state, recordedSec: 0))
    let call = try #require(object["call"] as? [String: Any])
    #expect(call["connectedAt"] as? String == "2027-01-15T08:00:00.125Z")
    #expect(call["reconnectCount"] as? Int == 0)
    let participant = try #require((call["participants"] as? [[String: Any]])?.first)
    #expect(participant["microphone"] as? String == "live")
    #expect(participant["camera"] as? String == "none")
  }

  @Test func datesRoundTripWithMilliseconds() throws {
    let warning = CaptureWarning(code: .fileFpsLow, message: "26 fps", since: Self.date)
    let data = try JSONCoding.encoder().encode(warning)
    #expect(try JSONCoding.decoder().decode(CaptureWarning.self, from: data) == warning)
  }
}

struct AudioLevelTests {
  private func level(_ samples: [Int16]) -> Double {
    samples.withUnsafeBufferPointer(AudioLevel.rmsDb)
  }

  @Test func silenceIsTheFloor() {
    #expect(level(Array(repeating: 0, count: 480)) == AudioLevel.floorDb)
  }

  @Test func fullScaleSquareIsZeroDb() {
    let square = (0..<480).map { $0.isMultiple(of: 2) ? Int16.max : Int16.min }
    #expect(abs(level(square)) < 0.01)
  }

  @Test func halfAmplitudeIsMinusSixDb() {
    let square = (0..<480).map { $0.isMultiple(of: 2) ? Int16(16_384) : Int16(-16_384) }
    #expect(abs(level(square) + 6.02) < 0.05)
  }
}

struct CaptureErrorCodeTests {
  @Test func onlyConfigurationAndPermissionProblemsAreUnrecoverable() {
    #expect(CaptureErrorCode.allCases.filter { !$0.isRecoverable }
      == [.permissionDenied, .configInvalid, .cameraFormatUnsupported, .recoveryUnplayable])
  }

  @Test func failureReadsAsCodeAndMessage() {
    let failure: Error = Failure(code: .micUnavailable, message: "No microphone buffers within 3000 ms")
    #expect(failure.localizedDescription == "micUnavailable: No microphone buffers within 3000 ms")
  }
}

struct AudioRouteTests {
  private static let airPods = AudioRoute.Port(name: "AirPods Pro", type: "BluetoothHFP")
  private static let speaker = AudioRoute.Port(name: "Speaker", type: "Speaker")

  @Test func eachSideReadsAsNameAndPortType() {
    let route = AudioRoute(inputs: [Self.airPods], outputs: [Self.airPods])
    #expect(route == AudioRoute(input: "AirPods Pro (BluetoothHFP)", output: "AirPods Pro (BluetoothHFP)"))
  }

  @Test func sideWithoutPortsReadsAsNone() {
    #expect(AudioRoute(inputs: [], outputs: [Self.speaker]).input == AudioRoute.noPort)
  }

  @Test func severalPortsKeepTheOrderIOSGives() {
    let route = AudioRoute(inputs: [], outputs: [Self.airPods, Self.speaker])
    #expect(route.output == "AirPods Pro (BluetoothHFP) + Speaker (Speaker)")
  }
}
