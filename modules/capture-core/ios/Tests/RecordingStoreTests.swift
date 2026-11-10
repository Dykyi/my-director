import Foundation
import Testing
@testable import CaptureCoreLogic

struct SessionIdTests {
  @Test func formatIsSortableAndFolderSafe() {
    #expect(SessionId.make(at: Fixtures.createdAt, suffix: 0x4F2A) == "2027-01-15T08-00-00Z-4F2A")
  }
}

struct SessionManifestTests {
  private let start = Fixtures.createdAt

  @Test func encodesSchemaVersion() throws {
    let json = try #require(String(data: JSONCoding.encoder().encode(Fixtures.manifest()), encoding: .utf8))
    #expect(json.contains("\"schemaVersion\":1"))
  }

  @Test func finalizedSegmentCountsTowardsRecordedTime() {
    var manifest = Fixtures.manifest()
    manifest.openSegment(index: 1, at: start)
    manifest.closeSegment(index: 1, outcome: .finalized(durationSec: 181.23, bytes: 136_712_345), pauseReason: .phoneCall, at: start)
    #expect(manifest.segments.first?.state == .finalized)
    #expect(manifest.segments.first?.pauseReason == .phoneCall)
    #expect(manifest.recordedSec == 181.23)
    #expect(manifest.state == .paused)
  }

  @Test func emptySegmentIsRemoved() {
    var manifest = Fixtures.manifest()
    manifest.openSegment(index: 1, at: start)
    manifest.closeSegment(index: 1, outcome: .empty, pauseReason: nil, at: start)
    #expect(manifest.segments.isEmpty)
  }

  @Test func openingSegmentRestartsHeartbeat() {
    var manifest = Fixtures.manifest()
    manifest.openSegment(index: 1, at: start)
    manifest.recordHeartbeat(lastVideoSec: 120, at: start.addingTimeInterval(120))
    manifest.closeSegment(index: 1, outcome: .finalized(durationSec: 121, bytes: 90_000_000), pauseReason: .phoneCall, at: start.addingTimeInterval(121))
    let resumedAt = start.addingTimeInterval(600)
    manifest.openSegment(index: 2, at: resumedAt)
    #expect(manifest.heartbeatAt == resumedAt)
    #expect(manifest.lastVideoSec == 0)
  }

  @Test func failedSegmentWaitsForInspection() {
    var manifest = Fixtures.manifest()
    manifest.openSegment(index: 1, at: start)
    manifest.closeSegment(index: 1, outcome: .failed(message: "-11800"), pauseReason: .fileError, at: start)
    #expect(manifest.segments.first?.state == .writing)
    manifest.applyInspection(SegmentInspection(playable: true, durationSec: 42, bytes: 30_000_000, failureReason: nil), toSegment: 1)
    #expect(manifest.segments.first?.state == .recovered)
    #expect(manifest.segments.first?.failure == "-11800")
  }
}

struct RecoveryTests {
  private func crashedManifest() -> SessionManifest {
    var manifest = Fixtures.manifest()
    manifest.openSegment(index: 1, at: Fixtures.createdAt)
    manifest.closeSegment(index: 1, outcome: .finalized(durationSec: 181.23, bytes: 136_000_000), pauseReason: .phoneCall, at: Fixtures.createdAt)
    manifest.openSegment(index: 2, at: Fixtures.createdAt)
    manifest.recordHeartbeat(lastVideoSec: 152.4, at: Fixtures.createdAt.addingTimeInterval(400))
    return manifest
  }

  @Test func crashDuringSecondSegment() {
    let inspection = SegmentInspection(playable: true, durationSec: 151.0, bytes: 114_000_000, failureReason: nil)
    let (manifest, report) = Recovery.recover(crashedManifest(), inspections: [2: inspection], directory: Fixtures.temporaryDirectory())
    #expect(manifest.state == .recovered)
    #expect(manifest.segments.map(\.state) == [.finalized, .recovered])
    #expect(abs(report.knownLossSec - 1.4) < 1e-9)
    #expect(report.maxUnseenLossSec == CaptureConfig.defaults.session.heartbeatIntervalSec)
    #expect(abs(report.recoveredSec - 332.23) < 1e-9)
  }

  @Test func unplayableSegmentIsReported() {
    let inspection = SegmentInspection(playable: false, durationSec: 0, bytes: 1_024, failureReason: "moov missing")
    let (manifest, report) = Recovery.recover(crashedManifest(), inspections: [2: inspection], directory: Fixtures.temporaryDirectory())
    #expect(manifest.segments.last?.state == .unplayable)
    #expect(report.segments.last?.failure == "moov missing")
  }

  @Test func recoveryIsOfferedAgainUntilAcknowledged() {
    let inspection = SegmentInspection(playable: true, durationSec: 151.0, bytes: 114_000_000, failureReason: nil)
    let directory = Fixtures.temporaryDirectory()
    var (manifest, report) = Recovery.recover(crashedManifest(), inspections: [2: inspection], directory: directory)
    #expect(Recovery.pendingReport(manifest, directory: directory) == report)
    manifest.acknowledgedAt = Fixtures.createdAt
    #expect(Recovery.pendingReport(manifest, directory: directory) == nil)
  }

  @Test func finishedSessionIsNeverOffered() {
    #expect(Recovery.pendingReport(Fixtures.manifest(), directory: Fixtures.temporaryDirectory()) == nil)
  }

  @Test func sessionPausedAtCrashLostNothing() {
    var manifest = Fixtures.manifest()
    manifest.openSegment(index: 1, at: Fixtures.createdAt)
    manifest.closeSegment(index: 1, outcome: .finalized(durationSec: 60, bytes: 45_000_000), pauseReason: .user, at: Fixtures.createdAt)
    let (_, report) = Recovery.recover(manifest, inspections: [:], directory: Fixtures.temporaryDirectory())
    #expect(report.knownLossSec == 0)
    #expect(report.maxUnseenLossSec == 0)
    #expect(report.recoveredSec == 60)
  }
}

final class RecordingStoreTests {
  private let store = RecordingStore(root: Fixtures.temporaryDirectory())

  deinit {
    try? FileManager.default.removeItem(at: store.root)
  }

  @Test func saveAndLoadRoundTrip() throws {
    var manifest = Fixtures.manifest()
    manifest.openSegment(index: 1, at: Fixtures.createdAt)
    try store.create(manifest)
    #expect(try store.load(manifest.id) == manifest)
  }

  @Test func saveReplacesPreviousManifest() throws {
    var manifest = Fixtures.manifest()
    try store.create(manifest)
    manifest.finish()
    try store.save(manifest)
    #expect(try store.load(manifest.id).state == .finished)
  }

  @Test func scanReturnsNewestFirstAndReportsUnreadable() throws {
    try store.create(Fixtures.manifest(id: "a", createdAt: Fixtures.createdAt))
    try store.create(Fixtures.manifest(id: "b", createdAt: Fixtures.createdAt.addingTimeInterval(60)))
    try FileManager.default.createDirectory(at: store.directory(for: "broken"), withIntermediateDirectories: true)
    try Data("{".utf8).write(to: store.directory(for: "broken").appending(path: RecordingStore.manifestFileName))
    try FileManager.default.createDirectory(at: store.directory(for: "no-manifest"), withIntermediateDirectories: true)
    let result = store.scan()
    #expect(result.manifests.map(\.id) == ["b", "a"])
    #expect(result.unreadable == ["broken"])
  }

  @Test func scanOfMissingRootIsEmpty() {
    let result = store.scan()
    #expect(result.manifests.isEmpty && result.unreadable.isEmpty)
  }

  @Test func deleteRemovesSessionFolder() throws {
    let manifest = Fixtures.manifest()
    try store.create(manifest)
    try store.delete(manifest.id)
    #expect(store.scan().manifests.isEmpty)
  }
}
