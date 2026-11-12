import Testing
@testable import CaptureCoreLogic

struct FrameSizedTests {
  private let camera = CaptureConfig.defaults.camera

  @Test func keepsTheLandscapeSizeForLandscapeFrames() {
    let turned = camera.turned(toMatchWidth: 1920, height: 1080)
    #expect(turned.width == 1920 && turned.height == 1080)
  }

  @Test func turnsTheFileSizeForPortraitFrames() {
    let turned = camera.turned(toMatchWidth: 1080, height: 1920)
    #expect(turned.width == 1080 && turned.height == 1920)
    #expect(turned.fps == camera.fps)
  }

  @Test func turnsTheCallSizeForPortraitFrames() {
    let profile = CallVideoProfile(width: 1280, height: 720, fps: 30)
    #expect(profile.turned(toMatchWidth: 1080, height: 1920) == CallVideoProfile(width: 720, height: 1280, fps: 30))
  }

  @Test func keepsTheSizeBeforeTheFirstFrame() {
    let turned = camera.turned(toMatchWidth: 0, height: 0)
    #expect(turned.width == 1920 && turned.height == 1080)
  }
}
