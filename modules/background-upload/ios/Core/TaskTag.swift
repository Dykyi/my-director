import Foundation

struct TaskTag: Equatable, Sendable {
  enum Kind: Equatable, Sendable {
    case part(number: Int, attempt: Int)
    case complete(attempt: Int)
  }

  private static let separator: Character = "|"

  var jobId: String
  var kind: Kind

  var partNumber: Int? {
    if case .part(let number, _) = kind { number } else { nil }
  }

  var taskDescription: String {
    switch kind {
    case .part(let number, let attempt): [jobId, "part", "\(number)", "\(attempt)"].joined(separator: String(Self.separator))
    case .complete(let attempt): [jobId, "complete", "\(attempt)"].joined(separator: String(Self.separator))
    }
  }

  init(jobId: String, kind: Kind) {
    self.jobId = jobId
    self.kind = kind
  }

  init?(_ taskDescription: String?) {
    let fields = taskDescription?.split(separator: Self.separator, omittingEmptySubsequences: false).map(String.init) ?? []
    switch fields.count {
    case 4 where fields[1] == "part":
      guard let number = Int(fields[2]), let attempt = Int(fields[3]) else { return nil }
      self.init(jobId: fields[0], kind: .part(number: number, attempt: attempt))
    case 3 where fields[1] == "complete":
      guard let attempt = Int(fields[2]) else { return nil }
      self.init(jobId: fields[0], kind: .complete(attempt: attempt))
    default:
      return nil
    }
  }
}
