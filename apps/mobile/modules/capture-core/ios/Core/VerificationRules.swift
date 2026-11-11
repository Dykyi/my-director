import Foundation

struct FrameTimeStats: Codable, Equatable, Sendable {
  static let gapFactor = 1.5

  var count: Int
  var durationSec: Double
  var fps: Double
  var gapCount: Int
  var longestIntervalSec: Double
  /// The same without the last interval, the one a crash cuts in a recovered segment.
  var gapCountBeforeLast: Int
  var longestIntervalBeforeLastSec: Double

  var gapRatio: Double { Self.ratio(gapCount, of: count - 1) }
  var gapRatioBeforeLast: Double { Self.ratio(gapCountBeforeLast, of: count - 2) }

  /// `times` may come in decode order (HEVC with B-frames); the stats are about presentation order.
  init(times: [Double], nominalFps: Double) {
    let times = times.sorted()
    let intervals = zip(times, times.dropFirst()).map { $1 - $0 }
    let beforeLast = intervals.dropLast()
    let isGap = { (interval: Double) in interval > Self.gapFactor / nominalFps }
    count = times.count
    durationSec = (times.last ?? 0) - (times.first ?? 0)
    fps = durationSec > 0 ? Double(count - 1) / durationSec : 0
    gapCount = intervals.filter(isGap).count
    longestIntervalSec = intervals.max() ?? 0
    gapCountBeforeLast = beforeLast.filter(isGap).count
    longestIntervalBeforeLastSec = beforeLast.max() ?? 0
  }

  private static func ratio(_ gaps: Int, of intervals: Int) -> Double {
    intervals > 0 ? Double(gaps) / Double(intervals) : 0
  }
}

struct SegmentFacts: Equatable, Sendable {
  var playable: Bool
  var videoCodec: String?
  var displayWidth: Int
  var displayHeight: Int
  var frames: FrameTimeStats
  /// Why the frames could not be read; the frame checks then fail with it instead of judging an empty list.
  var frameReadError: String? = nil
  var audioCodec: String?
  var audioSampleRate: Double?
  var audioChannels: Int?
  var videoDurationSec: Double
  var audioDurationSec: Double?
  var audioStartOffsetSec: Double?
  var manifestDurationSec: Double?
  /// Set only for a recovered segment: how much its tail may have lost (`knownLossSec + maxUnseenLossSec`).
  var recoveredTailSec: Double? = nil
}

struct VerificationCheck: Codable, Equatable, Sendable {
  var id: String
  var label: String
  var expected: String
  var actual: String
  var pass: Bool
  /// Passed only because a crash cut the recovered segment's tail here; `note` says how.
  var crashTail = false
  var note: String? = nil
}

extension VerificationCheck {
  /// Reports saved before crash tails lack both keys.
  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    label = try container.decode(String.self, forKey: .label)
    expected = try container.decode(String.self, forKey: .expected)
    actual = try container.decode(String.self, forKey: .actual)
    pass = try container.decode(Bool.self, forKey: .pass)
    crashTail = try container.decodeIfPresent(Bool.self, forKey: .crashTail) ?? false
    note = try container.decodeIfPresent(String.self, forKey: .note)
  }
}

struct SegmentVerification: Codable, Equatable, Sendable {
  var index: Int
  var uri: String
  var checks: [VerificationCheck]
  var pass: Bool
  var frameReadError: String?
}

struct VerificationReport: Codable, Equatable, Sendable {
  var sessionId: String
  var verifiedAt: Date
  var segments: [SegmentVerification]
  var pass: Bool
}

extension VerificationReport {
  var frameReadError: String? { segments.lazy.compactMap(\.frameReadError).first }

  var failedCheckIds: [String] {
    segments.flatMap { segment in segment.checks.filter { !$0.pass }.map { "\(segment.index):\($0.id)" } }
  }
}

/// `tools/verify/verify-recording.py` mirrors these checks.
enum VerificationRules {
  static let videoCodecs: Set<String> = ["hvc1", "avc1"]
  static let minShortSide = 1080
  static let fpsTolerance = 0.5
  static let maxGapRatio = 0.005
  static let maxIntervalSec = 0.1
  /// The longest gap is judged in whole milliseconds, as shown and as the Mac check reads it:
  /// two frames lost at 29.97 fps leave 100.1 ms.
  static let maxIntervalMs = 100
  static let audioCodec = "aac"
  static let minAudioSampleRate = 44_100.0
  static let maxDurationMismatchSec = 0.1
  static let maxAudioStartOffsetSec = 0.05
  static let maxManifestMismatchSec = 1.0
  /// Checks that judge the frame list; they fail with the reason when the frames could not be read.
  private static let frameCheckIds: Set<String> = ["fps", "gaps"]
  private static let crashTailNotes = [
    "gaps": "at the crash point: the app was closed here",
    "durations": "audio outlives the last frame after the crash",
  ]

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
        id: "gaps", label: "Frame gaps", expected: "≤ \(format(maxGapRatio * 100)) %, longest ≤ \(maxIntervalMs) ms",
        actual: "\(format(facts.frames.gapRatio * 100)) %, longest \(wholeMs(facts.frames.longestIntervalSec)) ms",
        pass: gapsWithinLimits(ratio: facts.frames.gapRatio, longestSec: facts.frames.longestIntervalSec)
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
    let cut = cutByCrash(facts)
    checks = checks.map { check in
      guard !check.pass, cut.contains(check.id) else { return check }
      var tail = check
      tail.pass = true
      tail.crashTail = true
      tail.note = crashTailNotes[check.id]
      return tail
    }
    guard let error = facts.frameReadError else { return checks }
    return checks.map { check in
      guard frameCheckIds.contains(check.id) else { return check }
      return VerificationCheck(id: check.id, label: check.label, expected: check.expected, actual: "not read: \(error)", pass: false)
    }
  }

  /// In a recovered segment: gaps only at the last frame interval, or audio past the last frame within the lost tail.
  private static func cutByCrash(_ facts: SegmentFacts) -> Set<String> {
    guard let tailSec = facts.recoveredTailSec else { return [] }
    var cut: Set<String> = []
    if gapsWithinLimits(ratio: facts.frames.gapRatioBeforeLast, longestSec: facts.frames.longestIntervalBeforeLastSec) {
      cut.insert("gaps")
    }
    if let audioPastVideoSec = facts.audioDurationSec.map({ $0 - facts.videoDurationSec }),
       audioPastVideoSec > 0, audioPastVideoSec <= tailSec {
      cut.insert("durations")
    }
    return cut
  }

  private static func gapsWithinLimits(ratio: Double, longestSec: Double) -> Bool {
    ratio <= maxGapRatio && wholeMs(longestSec) <= maxIntervalMs
  }

  private static func wholeMs(_ seconds: Double) -> Int {
    Int((seconds * 1000).rounded())
  }

  private static func format(_ value: Double) -> String {
    String(format: "%.2f", value)
  }
}
