import PackageDescription

let package = Package(
  name: "BackgroundUploadLogic",
  platforms: [.macOS(.v14), .iOS(.v17)],
  targets: [
    .target(name: "BackgroundUploadLogic", path: "ios/Core"),
    .testTarget(name: "BackgroundUploadLogicTests", dependencies: ["BackgroundUploadLogic"], path: "ios/Tests"),
  ]
)
