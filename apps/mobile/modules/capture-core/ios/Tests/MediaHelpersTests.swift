import AVFAudio
import Foundation
import Testing
@testable import CaptureCoreLogic

struct AudioTimelineConfigurationTests {
  @Test func captureLatencyAddsTheUnreportedVoiceProcessing() {
    let configuration = AudioTimeline.Configuration(sampleRate: 48_000, inputLatency: 0.01, ioBufferDuration: 0.005, resyncThreshold: 0.04)
    #expect(abs(configuration.captureLatency - 0.0385) < 1e-9)
  }
}

struct FrameHoleLogTests {
  @Test func describesTheHoleInMilliseconds() {
    let hole = FrameHoleProbe.Hole(
      gap: 0.2334, droppedFrames: ["OutOfBuffers": 2, "Discontinuity": 1], longestWork: "video", longestWorkDuration: 0.0416, arrivalLag: 0.012)
    #expect(hole.logData == [
      "gapMs": "233",
      "dropped": "Discontinuity 1, OutOfBuffers 2",
      "longestQueueWork": "video 42 ms",
      "arrivalLagMs": "12",
    ])
  }

  @Test func saysNoneWhenNothingExplainsIt() {
    let hole = FrameHoleProbe.Hole(gap: 0.15, droppedFrames: [:], longestWork: nil, longestWorkDuration: 0, arrivalLag: 0)
    #expect(hole.logData["dropped"] == "none")
    #expect(hole.logData["longestQueueWork"] == "none")
  }
}

struct ThermalLevelTests {
  @Test func followsTheProcessThermalState() {
    #expect(ThermalLevel(ProcessInfo.ThermalState.nominal) == .nominal)
    #expect(ThermalLevel(ProcessInfo.ThermalState.fair) == .fair)
    #expect(ThermalLevel(ProcessInfo.ThermalState.serious) == .serious)
    #expect(ThermalLevel(ProcessInfo.ThermalState.critical) == .critical)
  }
}

struct CameraFormatChoiceTests {
  private let camera = CaptureConfig.defaults.camera

  private func format(_ width: Int = 1920, _ height: Int = 1080, fullRange: Bool = true, maxFps: Double = 30, binned: Bool = false)
    -> CameraFormatCandidate {
    CameraFormatCandidate(width: width, height: height, isFullRange420: fullRange, frameRateRanges: [1...maxFps], isBinned: binned)
  }

  @Test func needsTheExactSizeFullRangeAndFps() {
    #expect(CameraFormatCandidate.bestIndex(in: [format(1280, 720), format(fullRange: false), format(maxFps: 24)], for: camera) == nil)
  }

  @Test func prefersUnbinnedThenTheLowestMaximumRate() {
    let formats = [format(maxFps: 60), format(maxFps: 30, binned: true), format(maxFps: 30), format(maxFps: 240)]
    #expect(CameraFormatCandidate.bestIndex(in: formats, for: camera) == 2)
  }
}

struct PCMResamplerTests {
  @Test func turnsBluetoothRateIntoTheFileFormat() throws {
    let input = try #require(AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 16_000, channels: 1, interleaved: false))
    let resampler = try #require(PCMResampler(from: input))
    var outputFrames = 0
    for _ in 0..<10 {
      let buffer = try #require(AVAudioPCMBuffer(pcmFormat: input, frameCapacity: 1600))
      buffer.frameLength = 1600
      let output = try #require(resampler.convert(buffer))
      #expect(output.format == PCMResampler.fileFormat)
      outputFrames += Int(output.frameLength)
    }
    // The converter keeps about 3 ms of look-ahead in flight; nothing else is lost.
    #expect((47_808...48_000).contains(outputFrames))
  }
}
