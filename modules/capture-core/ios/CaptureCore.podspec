Pod::Spec.new do |s|
  s.name             = 'CaptureCore'
  s.version          = '0.1.0'
  s.summary          = 'One camera and microphone feeding a LiveKit call and a local recording'
  s.homepage         = 'https://github.com/mydirector/mydirector-ios-capture-poc'
  s.license          = 'UNLICENSED'
  s.author           = 'MyDirector'
  s.source           = { git: '' }
  s.platforms        = { :ios => '17.0' }
  s.swift_version    = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'LiveKitClient', '2.19.0'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files  = '**/*.swift'
  s.exclude_files = 'Tests/**'
end
