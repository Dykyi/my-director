import Foundation

struct UploadJob: Codable, Equatable, Sendable {
  enum Phase: String, Codable, Sendable { case preparing, uploading, completing, verified, failed, cancelled }
  enum PartState: String, Codable, Sendable { case pending, inFlight, done, failed }

  struct Part: Codable, Equatable, Sendable {
    var number: Int
    var size: Int64
    var md5: String
    var url: String
    var headers: [String: String]
    var state = PartState.pending
    var attempt = 0
    var etag: String?
  }

  struct Retry: Codable, Equatable, Sendable {
    var partNumber: Int
    var attempt: Int
    var reason: String
    var at: Date
  }

  static let completePartNumber = 0
  static let maxBackoffSec = 60.0

  var id: String
  var fileUri: String
  var objectKey: String
  var api: UploadApi
  var maxAttemptsPerPart: Int
  var bytesTotal: Int64
  var uploadId: String?
  var phase = Phase.preparing
  var parts: [Part] = []
  var completeAttempt = 0
  var retries: [Retry] = []
  var serverSize: Int64?
  var error: String?
  var updatedAt: Date

  var bytesConfirmed: Int64 { parts.filter { $0.state == .done }.map(\.size).reduce(0, +) }
  var partsDone: Int { parts.filter { $0.state == .done }.count }
  var completeRequest: CompleteUploadRequest {
    CompleteUploadRequest(
      key: objectKey,
      size: bytesTotal,
      parts: parts.compactMap { part in part.etag.map { CompleteUploadRequest.Part(partNumber: part.number, etag: $0) } }
    )
  }

  static func backoff(attempt: Int) -> Double {
    min(pow(2, Double(attempt)), maxBackoffSec)
  }
}

enum UploadEvent: Equatable, Sendable {
  case planned(uploadId: String, parts: [UploadJob.Part])
  case preparationFailed(String)
  case partFinished(number: Int, status: Int?, etag: String?, error: String?)
  case digestChecked(number: Int, matches: Bool)
  case completeFinished(status: Int?, response: CompleteUploadResponse?, error: String?)
  case retryFailedRequested
  case cancelRequested
  case reconciled(livePartNumbers: Set<Int>, completeIsLive: Bool)
}

enum UploadCommand: Equatable, Sendable {
  case startPart(number: Int, delaySec: Double)
  case checkDigest(number: Int)
  case startComplete(delaySec: Double)
  case cancelTasks
  case finishVerified
  case finishFailed
}

extension UploadJob {
  private enum PartResult {
    case success(etag: String)
    case retryable(String)
    case badDigest
    case expired
    case rejected(Int)
  }

  mutating func handle(_ event: UploadEvent, at now: Date) -> [UploadCommand] {
    updatedAt = now
    switch event {
    case .planned(let uploadId, let planned):
      guard phase == .preparing else { return [] }
      self.uploadId = uploadId
      parts = planned.map { part in
        var part = part
        part.state = .inFlight
        return part
      }
      phase = .uploading
      return parts.map { .startPart(number: $0.number, delaySec: 0) }

    case .preparationFailed(let message):
      guard phase == .preparing else { return [] }
      return fail(message)

    case .partFinished(let number, let status, let etag, let error):
      guard phase == .uploading, let index = parts.firstIndex(where: { $0.number == number }), parts[index].state == .inFlight else {
        return []
      }
      switch Self.classify(status: status, etag: etag, error: error) {
      case .success(let etag):
        parts[index].state = .done
        parts[index].etag = etag
        return completeIfReady()
      case .retryable(let reason):
        return retry(partAt: index, reason: reason, at: now)
      case .badDigest:
        return [.checkDigest(number: number)]
      case .expired:
        parts[index].state = .failed
        return fail("Presigned URL expired or invalid (part \(number))")
      case .rejected(let status):
        parts[index].state = .failed
        return fail("Part \(number) rejected with HTTP \(status)")
      }

    case .digestChecked(let number, let matches):
      guard phase == .uploading, let index = parts.firstIndex(where: { $0.number == number }) else { return [] }
      guard matches else {
        parts[index].state = .failed
        return fail("Part \(number) changed on disk")
      }
      return retry(partAt: index, reason: "BadDigest", at: now)

    case .completeFinished(let status, let response, let error):
      guard phase == .completing else { return [] }
      if let response, status == 200 || status == 422 {
        serverSize = response.size ?? response.actual
        guard response.verified, response.size == bytesTotal else {
          return fail("Server stored \(serverSize ?? 0) bytes, expected \(bytesTotal)")
        }
        phase = .verified
        return [.finishVerified]
      }
      guard Self.isRetryable(status) else { return fail("Completion rejected with HTTP \(status ?? 0)") }
      completeAttempt += 1
      let reason = status.map { "HTTP \($0)" } ?? error ?? "network error"
      retries.append(Retry(partNumber: Self.completePartNumber, attempt: completeAttempt, reason: reason, at: now))
      guard completeAttempt <= maxAttemptsPerPart else { return fail("Completion failed after \(maxAttemptsPerPart) attempts: \(reason)") }
      return [.startComplete(delaySec: Self.backoff(attempt: completeAttempt))]

    case .retryFailedRequested:
      guard phase == .failed, uploadId != nil else { return [] }
      error = nil
      if parts.allSatisfy({ $0.state == .done }) {
        phase = .completing
        completeAttempt = 0
        return [.startComplete(delaySec: 0)]
      }
      phase = .uploading
      return parts.indices.compactMap { index in
        guard parts[index].state != .done else { return nil }
        parts[index].state = .inFlight
        parts[index].attempt = 0
        return .startPart(number: parts[index].number, delaySec: 0)
      }

    case .cancelRequested:
      guard phase != .verified, phase != .cancelled else { return [] }
      phase = .cancelled
      return [.cancelTasks]

    case .reconciled(let live, let completeIsLive):
      switch phase {
      case .uploading:
        return parts.filter { $0.state == .inFlight && !live.contains($0.number) }.map { .startPart(number: $0.number, delaySec: 0) }
      case .completing:
        return completeIsLive ? [] : [.startComplete(delaySec: 0)]
      default:
        return []
      }
    }
  }

  private mutating func retry(partAt index: Int, reason: String, at now: Date) -> [UploadCommand] {
    parts[index].attempt += 1
    let attempt = parts[index].attempt
    retries.append(Retry(partNumber: parts[index].number, attempt: attempt, reason: reason, at: now))
    guard attempt <= maxAttemptsPerPart else {
      parts[index].state = .failed
      return fail("Part \(parts[index].number) failed after \(maxAttemptsPerPart) attempts: \(reason)")
    }
    return [.startPart(number: parts[index].number, delaySec: Self.backoff(attempt: attempt))]
  }

  private mutating func completeIfReady() -> [UploadCommand] {
    guard parts.allSatisfy({ $0.state == .done }) else { return [] }
    phase = .completing
    return [.startComplete(delaySec: 0)]
  }

  private mutating func fail(_ message: String) -> [UploadCommand] {
    phase = .failed
    error = message
    for index in parts.indices where parts[index].state == .inFlight {
      parts[index].state = .pending
    }
    return [.cancelTasks, .finishFailed]
  }

  private static func classify(status: Int?, etag: String?, error: String?) -> PartResult {
    guard let status else { return .retryable(error ?? "network error") }
    switch status {
    case 200: return etag.map { .success(etag: $0) } ?? .retryable("HTTP 200 without ETag")
    case 400: return .badDigest
    case 403: return .expired
    default: return isRetryable(status) ? .retryable("HTTP \(status)") : .rejected(status)
    }
  }

  private static func isRetryable(_ status: Int?) -> Bool {
    guard let status else { return true }
    return status == 408 || status == 429 || (500...599).contains(status)
  }
}
