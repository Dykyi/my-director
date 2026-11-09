import Foundation

struct FrameTimeStats: Codable, Equatable, Sendable {
  static let gapFactor = 1.5

  var count: Int
  var durationSec: Double
  var fps: Double
  var gapCount: Int
  var longestIntervalSec: Double

  var gapRatio: Double { count > 1 ? Double(gapCount) / Double(count - 1) : 0 }

  init(times: [Double], nominalFps: Double) {
    let intervals = zip(times, times.dropFirst()).map { $1 - $0 }
    count = times.count
    durationSec = (times.last ?? 0) - (times.first ?? 0)
    fps = durationSec > 0 ? Double(count - 1) / durationSec : 0
    gapCount = intervals.filter { $0 > Self.gapFactor / nominalFps }.count
    longestIntervalSec = intervals.max() ?? 0
  }
}

struct SegmentFacts: Equatable, Sendable {
  var playable: Bool
  var videoCodec: String?
  var displayWidth: Int
  var displayHeight: Int
  var frames: FrameTimeStats
  var audioCodec: String?
  var audioSampleRate: Double?
  var audioChannels: Int?
  var videoDurationSec: Double
  var audioDurationSec: Double?
  var audioStartOffsetSec: Double?
  var manifestDurationSec: Double?
}

struct VerificationCheck: Codable, Equatable, Sendable {
  var id: String
  var label: String
  var expected: String
  var actual: String
  var pass: Bool
}

struct SegmentVerification: Codable, Equatable, Sendable {
  var index: Int
  var uri: String
  var checks: [VerificationCheck]
  var pass: Bool
}

struct VerificationReport: Codable, Equatable, Sendable {
  var sessionId: String
  var verifiedAt: Date
  var segments: [SegmentVerification]
  var pass: Bool
}

enum VerificationRules {
  static let videoCodecs: Set<String> = ["hvc1", "avc1"]
  static let minShortSide = 1080
  static let fpsTolerance = 0.5
  static let maxGapRatio = 0.005
  static let maxIntervalSec = 0.1
  static let audioCodec = "aac"
  static let minAudioSampleRate = 44_100.0
  static let maxDurationMismatchSec = 0.1
  static let maxAudioStartOffsetSec = 0.05
  static let maxManifestMismatchSec = 1.0

  static func evaluate(_ facts: SegmentFacts, nominalFps: Double) -> [VerificationCheck] {
    let minFps = nominalFps - fpsTolerance
    let durationMismatch = facts.audioDurationSec.map { abs(facts.videoDurationSec - $0) }
    var checks = [
      VerificationCheck(id: "playable", label: "Plays", expected: "true", actual: String(facts.playable), pass: facts.playable),
      VerificationCheck(
        id: "videoCodec", label: "Video codec", expected: "hvc1 or avc1", actual: facts.videoCodec ?? "none",
        pass: facts.videoCodec.map(videoCodecs.contains) ?? false
      ),
      VerificationCheck(
        id: "resolution", label: "Resolution", expected: "short side ≥ \(minShortSide)",
        actual: "\(facts.displayWidth)x\(facts.displayHeight)",
        pass: min(facts.displayWidth, facts.displayHeight) >= minShortSide
      ),
      VerificationCheck(
        id: "fps", label: "Frame rate", expected: "≥ \(format(minFps))", actual: format(facts.frames.fps),
        pass: facts.frames.fps >= minFps
      ),
      VerificationCheck(
        id: "gaps", label: "Frame gaps", expected: "≤ \(format(maxGapRatio * 100)) %, longest ≤ \(Int(maxIntervalSec * 1000)) ms",
        actual: "\(format(facts.frames.gapRatio * 100)) %, longest \(Int(facts.frames.longestIntervalSec * 1000)) ms",
        pass: facts.frames.gapRatio <= maxGapRatio && facts.frames.longestIntervalSec <= maxIntervalSec
      ),
      VerificationCheck(
        id: "audio", label: "Audio track", expected: "AAC, ≥ \(Int(minAudioSampleRate)) Hz",
        actual: "\(facts.audioCodec ?? "none"), \(Int(facts.audioSampleRate ?? 0)) Hz, \(facts.audioChannels ?? 0) ch",
        pass: facts.audioCodec == audioCodec && (facts.audioSampleRate ?? 0) >= minAudioSampleRate
      ),
      VerificationCheck(
        id: "durations", label: "Audio and video length", expected: "differ ≤ \(Int(maxDurationMismatchSec * 1000)) ms",
        actual: durationMismatch.map { "\(Int($0 * 1000)) ms" } ?? "no audio",
        pass: durationMismatch.map { $0 <= maxDurationMismatchSec } ?? false
      ),
      VerificationCheck(
        id: "audioStart", label: "Audio start", expected: "within \(Int(maxAudioStartOffsetSec * 1000)) ms of video",
        actual: facts.audioStartOffsetSec.map { "\(Int($0 * 1000)) ms" } ?? "no audio",
        pass: facts.audioStartOffsetSec.map { abs($0) <= maxAudioStartOffsetSec } ?? false
      ),
    ]
    if let manifestDuration = facts.manifestDurationSec {
      let mismatch = abs(facts.videoDurationSec - manifestDuration)
      checks.append(VerificationCheck(
        id: "manifestDuration", label: "Length vs manifest", expected: "± \(format(maxManifestMismatchSec)) s",
        actual: "\(format(mismatch)) s", pass: mismatch <= maxManifestMismatchSec
      ))
    }
    return checks
  }

  private static func format(_ value: Double) -> String {
    String(format: "%.2f", value)
  }
}
