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
