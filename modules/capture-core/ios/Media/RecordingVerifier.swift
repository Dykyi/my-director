import AVFoundation

enum RecordingVerifier {
  static func verify(_ manifest: SessionManifest, directory: URL) async -> VerificationReport {
    let nominalFps = Double(manifest.config.camera.fps)
    var segments: [SegmentVerification] = []
    for segment in manifest.segments {
      let url = directory.appending(path: segment.file)
      let facts = await facts(for: url, manifestDurationSec: segment.durationSec, nominalFps: nominalFps)
      let checks = VerificationRules.evaluate(facts, nominalFps: nominalFps)
      segments.append(SegmentVerification(index: segment.index, uri: url.absoluteString, checks: checks, pass: checks.allSatisfy(\.pass)))
    }
    return VerificationReport(
      sessionId: manifest.id,
      verifiedAt: Date(),
      segments: segments,
      pass: !segments.isEmpty && segments.allSatisfy(\.pass)
    )
  }

  static func facts(for url: URL, manifestDurationSec: Double?, nominalFps: Double) async -> SegmentFacts {
    let asset = AVURLAsset(url: url)
    var facts = SegmentFacts(
      playable: (try? await asset.load(.isPlayable)) ?? false,
      videoCodec: nil,
      displayWidth: 0,
      displayHeight: 0,
      frames: FrameTimeStats(times: [], nominalFps: nominalFps),
      audioCodec: nil,
      audioSampleRate: nil,
      audioChannels: nil,
      videoDurationSec: 0,
      audioDurationSec: nil,
      audioStartOffsetSec: nil,
      manifestDurationSec: manifestDurationSec
    )
    var videoStart: CMTime?
    if let track = try? await asset.loadTracks(withMediaType: .video).first,
       let (formats, size, transform, timeRange) = try? await track.load(.formatDescriptions, .naturalSize, .preferredTransform, .timeRange) {
      facts.videoCodec = formats.first.map { fourCharacterCode(CMFormatDescriptionGetMediaSubType($0)) }
      let displayed = CGRect(origin: .zero, size: size).applying(transform)
      facts.displayWidth = Int(abs(displayed.width).rounded())
      facts.displayHeight = Int(abs(displayed.height).rounded())
      facts.videoDurationSec = timeRange.duration.seconds
      videoStart = timeRange.start
      if let times = try? await FrameTimeReader.presentationTimes(of: asset) {
        facts.frames = FrameTimeStats(times: times, nominalFps: nominalFps)
      }
    }
    if let track = try? await asset.loadTracks(withMediaType: .audio).first,
       let (formats, timeRange) = try? await track.load(.formatDescriptions, .timeRange),
       let format = formats.first,
       let description = CMAudioFormatDescriptionGetStreamBasicDescription(format)?.pointee {
      facts.audioCodec = fourCharacterCode(description.mFormatID)
      facts.audioSampleRate = description.mSampleRate
      facts.audioChannels = Int(description.mChannelsPerFrame)
      facts.audioDurationSec = timeRange.duration.seconds
      facts.audioStartOffsetSec = videoStart.map { (timeRange.start - $0).seconds }
    }
    return facts
  }

  private static func fourCharacterCode(_ code: FourCharCode) -> String {
    let bytes = [24, 16, 8, 0].map { UInt8((code >> $0) & 0xFF) }
    return String(decoding: bytes, as: UTF8.self).trimmingCharacters(in: .whitespaces)
  }
}
