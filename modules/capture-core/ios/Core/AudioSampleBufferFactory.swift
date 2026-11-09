import CoreMedia

struct CoreMediaError: Error, Equatable, Sendable {
  var operation: String
  var status: OSStatus
}

final class AudioSampleBufferFactory {
  static let bytesPerFrame = MemoryLayout<Int16>.size

  let sampleRate: Double
  private let format: CMAudioFormatDescription

  init(sampleRate: Double) throws {
    self.sampleRate = sampleRate
    var description = AudioStreamBasicDescription(
      mSampleRate: sampleRate,
      mFormatID: kAudioFormatLinearPCM,
      mFormatFlags: kLinearPCMFormatFlagIsSignedInteger | kLinearPCMFormatFlagIsPacked,
      mBytesPerPacket: UInt32(Self.bytesPerFrame),
      mFramesPerPacket: 1,
      mBytesPerFrame: UInt32(Self.bytesPerFrame),
      mChannelsPerFrame: 1,
      mBitsPerChannel: 16,
      mReserved: 0
    )
    var format: CMAudioFormatDescription?
    try check("CMAudioFormatDescriptionCreate", CMAudioFormatDescriptionCreate(
      allocator: kCFAllocatorDefault, asbd: &description, layoutSize: 0, layout: nil,
      magicCookieSize: 0, magicCookie: nil, extensions: nil, formatDescriptionOut: &format
    ))
    self.format = try unwrap(format, "CMAudioFormatDescriptionCreate")
  }

  func makeBuffer(samples: UnsafeBufferPointer<Int16>, presentationTime: Double) throws -> CMSampleBuffer {
    let block = try makeBlock(frameCount: samples.count)
    if let base = samples.baseAddress {
      try check("CMBlockBufferReplaceDataBytes", CMBlockBufferReplaceDataBytes(
        with: base, blockBuffer: block, offsetIntoDestination: 0, dataLength: samples.count * Self.bytesPerFrame
      ))
    }
    return try makeSampleBuffer(block: block, frameCount: samples.count, presentationTime: presentationTime)
  }

  func makeSilence(frameCount: Int, presentationTime: Double) throws -> CMSampleBuffer {
    let block = try makeBlock(frameCount: frameCount)
    try check("CMBlockBufferFillDataBytes", CMBlockBufferFillDataBytes(
      with: 0, blockBuffer: block, offsetIntoDestination: 0, dataLength: frameCount * Self.bytesPerFrame
    ))
    return try makeSampleBuffer(block: block, frameCount: frameCount, presentationTime: presentationTime)
  }

  private func makeBlock(frameCount: Int) throws -> CMBlockBuffer {
    let length = frameCount * Self.bytesPerFrame
    var block: CMBlockBuffer?
    try check("CMBlockBufferCreateWithMemoryBlock", CMBlockBufferCreateWithMemoryBlock(
      allocator: kCFAllocatorDefault, memoryBlock: nil, blockLength: length, blockAllocator: kCFAllocatorDefault,
      customBlockSource: nil, offsetToData: 0, dataLength: length, flags: kCMBlockBufferAssureMemoryNowFlag,
      blockBufferOut: &block
    ))
    return try unwrap(block, "CMBlockBufferCreateWithMemoryBlock")
  }

  private func makeSampleBuffer(block: CMBlockBuffer, frameCount: Int, presentationTime: Double) throws -> CMSampleBuffer {
    var sampleBuffer: CMSampleBuffer?
    try check("CMAudioSampleBufferCreateReadyWithPacketDescriptions", CMAudioSampleBufferCreateReadyWithPacketDescriptions(
      allocator: kCFAllocatorDefault, dataBuffer: block, formatDescription: format, sampleCount: frameCount,
      presentationTimeStamp: CMTime(seconds: presentationTime, preferredTimescale: CMTimeScale(sampleRate)),
      packetDescriptions: nil, sampleBufferOut: &sampleBuffer
    ))
    return try unwrap(sampleBuffer, "CMAudioSampleBufferCreateReadyWithPacketDescriptions")
  }
}

private func check(_ operation: String, _ status: OSStatus) throws {
  guard status == noErr else { throw CoreMediaError(operation: operation, status: status) }
}

private func unwrap<T>(_ value: T?, _ operation: String) throws -> T {
  guard let value else { throw CoreMediaError(operation: operation, status: kCMSampleBufferError_AllocationFailed) }
  return value
}
