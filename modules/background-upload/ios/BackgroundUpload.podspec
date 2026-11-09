Pod::Spec.new do |s|
  s.name             = 'BackgroundUpload'
  s.version          = '0.1.0'
  s.summary          = 'Resumable background upload of large files to presigned part URLs'
  s.homepage         = 'https://github.com/mydirector/mydirector-ios-capture-poc'
  s.license          = 'UNLICENSED'
  s.author           = 'MyDirector'
  s.source           = { git: '' }
  s.platforms        = { :ios => '17.0' }
  s.swift_version    = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files  = '**/*.swift'
  s.exclude_files = 'Tests/**'
end
