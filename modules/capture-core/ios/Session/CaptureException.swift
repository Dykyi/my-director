import ExpoModulesCore

final class CaptureException: Exception, @unchecked Sendable {
  private let failure: Failure

  init(_ failure: Failure, file: String = #fileID, line: UInt = #line, function: String = #function) {
    self.failure = failure
    super.init(file: file, line: line, function: function)
  }

  override var code: String { failure.code.rawValue }
  override var reason: String { failure.message }
}

extension Failure {
  init(_ error: Error, fallback code: CaptureErrorCode) {
    self = error as? Failure ?? Failure(code: code, message: error.localizedDescription)
  }
}
