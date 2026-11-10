import Foundation
import Testing
@testable import CaptureCoreLogic

struct BitrateMeterTests {
  private func rates(_ samples: [(bytes: UInt64, timestampUs: Double)]) -> [Double] {
    var meter = BitrateMeter()
    return samples.map { sample in
      meter.update(bytesSent: sample.bytes, timestampUs: sample.timestampUs)
      return meter.kbps
    }
  }

  @Test func needsTwoSamples() {
    #expect(rates([(1_000, 1_000_000)]) == [0])
  }

  @Test func measuresBetweenWebRTCSamples() {
    #expect(rates([(0, 1_000_000), (125_000, 2_000_000)]) == [0, 1000])
  }

  @Test func repeatedSampleKeepsTheRate() {
    #expect(rates([(0, 1_000_000), (125_000, 2_000_000), (250_000, 2_000_000)]) == [0, 1000, 1000])
  }

  @Test func counterResetKeepsTheLastRate() {
    #expect(rates([(0, 1_000_000), (125_000, 2_000_000), (10, 3_000_000), (62_510, 4_000_000)]) == [0, 1000, 1000, 500])
  }
}

struct QualityLimitationTests {
  @Test func mapsWebRTCReasons() {
    #expect(HealthSnapshot.QualityLimitation(webRTCReason: nil) == HealthSnapshot.QualityLimitation.none)
    #expect(HealthSnapshot.QualityLimitation(webRTCReason: "bandwidth") == .bandwidth)
    #expect(HealthSnapshot.QualityLimitation(webRTCReason: "resolution") == .other)
  }
}

struct FailedCheckIdsTests {
  @Test func listsFailedChecksBySegment() {
    func check(_ id: String, _ pass: Bool) -> VerificationCheck {
      VerificationCheck(id: id, label: id, expected: "", actual: "", pass: pass)
    }
    let report = VerificationReport(sessionId: "s", verifiedAt: Fixtures.createdAt, segments: [
      SegmentVerification(index: 1, uri: "", checks: [check("fps", true), check("gaps", false)], pass: false),
      SegmentVerification(index: 2, uri: "", checks: [check("audioStart", false)], pass: false),
    ], pass: false)
    #expect(report.failedCheckIds == ["1:gaps", "2:audioStart"])
  }
}

struct RejoinPlanTests {
  @Test func followsTheConnection() {
    #expect(RejoinPlan(connection: .connected) == .keep)
    #expect(RejoinPlan(connection: .connecting) == .waitForReconnect)
    #expect(RejoinPlan(connection: .reconnecting) == .waitForReconnect)
    #expect(RejoinPlan(connection: .disconnected) == .rejoin)
    #expect(RejoinPlan(connection: nil) == .rejoin)
  }
}

struct RejoinTracksTests {
  @Test func onlyARecordingPhonePublishesOnRejoin() {
    #expect(RejoinPlan.publishesTracks(in: .recording))
    #expect(!RejoinPlan.publishesTracks(in: .paused))
    #expect(!RejoinPlan.publishesTracks(in: .pausing))
    #expect(!RejoinPlan.publishesTracks(in: .resuming))
  }
}
