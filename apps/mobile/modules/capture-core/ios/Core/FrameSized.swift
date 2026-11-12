/// Configured sizes are landscape, but the iPhone 17 front camera sensor is mounted in portrait and delivers
/// portrait frames; the file and the call take the frames' orientation, or the picture gets stretched.
protocol FrameSized {
  var width: Int { get set }
  var height: Int { get set }
}

extension FrameSized {
  func turned(toMatchWidth frameWidth: Int, height frameHeight: Int) -> Self {
    guard (frameHeight > frameWidth) != (height > width) else { return self }
    var turned = self
    (turned.width, turned.height) = (height, width)
    return turned
  }
}

extension CaptureConfig.Camera: FrameSized {}
extension CallVideoProfile: FrameSized {}
