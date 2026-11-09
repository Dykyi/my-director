import AVFoundation

enum FrameTimeReader {
  static func presentationTimes(of asset: AVURLAsset) async throws -> [Double] {
    guard let track = try await asset.loadTracks(withMediaType: .video).first else { return [] }
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: nil)
    output.alwaysCopiesSampleData = false
    reader.add(output)
    guard reader.startReading() else {
      throw reader.error ?? Failure(code: .recoveryUnplayable, message: "The asset reader did not start")
    }
    var times: [Double] = []
    while let sample = output.copyNextSampleBuffer() {
      guard CMSampleBufferGetNumSamples(sample) > 0 else { continue }
      times.append(CMSampleBufferGetPresentationTimeStamp(sample).seconds)
    }
    if reader.status == .failed {
      throw reader.error ?? Failure(code: .recoveryUnplayable, message: "The asset reader failed")
    }
    return times.sorted()
  }
}
