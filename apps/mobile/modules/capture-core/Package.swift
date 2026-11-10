// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "CaptureCoreLogic",
  platforms: [.macOS(.v14), .iOS(.v17)],
  targets: [
    .target(name: "CaptureCoreLogic", path: "ios/Core"),
    .testTarget(name: "CaptureCoreLogicTests", dependencies: ["CaptureCoreLogic"], path: "ios/Tests"),
  ]
)
