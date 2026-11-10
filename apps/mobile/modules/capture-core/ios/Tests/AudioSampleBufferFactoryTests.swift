import CoreMedia
import Testing
@testable import CaptureCoreLogic

struct AudioSampleBufferFactoryTests {
  private static let sampleRate = 48_000.0
  private static let frames = 480

  private func samples(of buffer: CMSampleBuffer) throws -> [Int16] {
    let block = try #require(CMSampleBufferGetDataBuffer(buffer))
    var samples = [Int16](repeating: -1, count: CMSampleBufferGetNumSamples(buffer))
    let status = samples.withUnsafeMutableBytes { bytes in
      CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: bytes.count, destination: bytes.baseAddress!)
    }
    #expect(status == noErr)
    return samples
  }

  @Test func bufferCarriesSamplesAndTiming() throws {
    let factory = try AudioSampleBufferFactory(sampleRate: Self.sampleRate)
    let input = (0..<Self.frames).map { Int16($0 - 240) }
    let buffer = try input.withUnsafeBufferPointer { try factory.makeBuffer(samples: $0, presentationTime: 1_000.5) }
    #expect(CMSampleBufferGetNumSamples(buffer) == Self.frames)
    #expect(abs(CMSampleBufferGetPresentationTimeStamp(buffer).seconds - 1_000.5) < 1e-6)
    #expect(abs(CMSampleBufferGetDuration(buffer).seconds - 0.01) < 1e-6)
    #expect(try samples(of: buffer) == input)
  }

  @Test func silenceIsZeros() throws {
    let factory = try AudioSampleBufferFactory(sampleRate: Self.sampleRate)
    let buffer = try factory.makeSilence(frameCount: 4_800, presentationTime: 10)
    #expect(CMSampleBufferGetNumSamples(buffer) == 4_800)
    #expect(try samples(of: buffer).allSatisfy { $0 == 0 })
  }

  @Test func formatIsSixteenBitMono() throws {
    let factory = try AudioSampleBufferFactory(sampleRate: Self.sampleRate)
    let buffer = try factory.makeSilence(frameCount: Self.frames, presentationTime: 0)
    let format = try #require(CMSampleBufferGetFormatDescription(buffer))
    let description = try #require(CMAudioFormatDescriptionGetStreamBasicDescription(format)?.pointee)
    #expect(description.mSampleRate == Self.sampleRate)
    #expect(description.mChannelsPerFrame == 1)
    #expect(description.mBitsPerChannel == 16)
  }
}
