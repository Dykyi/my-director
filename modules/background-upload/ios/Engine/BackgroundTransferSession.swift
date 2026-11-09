import Foundation

@MainActor
protocol BackgroundTransferDelegate: AnyObject {
  func transfer(_ tag: TaskTag, finishedWith status: Int?, etag: String?, body: Data, error: Error?)
  func transferRestartedBySystem(_ tag: TaskTag)
  func transfersDrained()
}

@MainActor
final class BackgroundTransferSession: NSObject, URLSessionDataDelegate {
  nonisolated static let identifier = "\(Bundle.main.bundleIdentifier ?? "mydirector").background-upload"
  private static let resourceTimeoutSec: TimeInterval = 24 * 60 * 60
  private static let connectionsPerHost = 4

  weak var delegate: BackgroundTransferDelegate?
  private var responseBodies: [Int: Data] = [:]
  private var lastTotalBytesSent: [Int: Int64] = [:]

  private lazy var session: URLSession = {
    let configuration = URLSessionConfiguration.background(withIdentifier: Self.identifier)
    configuration.isDiscretionary = false
    configuration.sessionSendsLaunchEvents = true
    configuration.allowsCellularAccess = true
    configuration.allowsExpensiveNetworkAccess = true
    configuration.allowsConstrainedNetworkAccess = true
    configuration.timeoutIntervalForResource = Self.resourceTimeoutSec
    configuration.httpMaximumConnectionsPerHost = Self.connectionsPerHost
    return URLSession(configuration: configuration, delegate: self, delegateQueue: .main)
  }()

  func activate() {
    _ = session
  }

  func upload(_ request: URLRequest, fromFile file: URL, tag: TaskTag, delaySec: Double) {
    let task = session.uploadTask(with: request, fromFile: file)
    task.taskDescription = tag.taskDescription
    if delaySec > 0 {
      task.earliestBeginDate = .now.addingTimeInterval(delaySec)
    }
    task.resume()
  }

  func liveTags() async -> [TaskTag] {
    await session.allTasks
      .filter { $0.state != .canceling && ($0.error as? URLError)?.code != .cancelled }
      .compactMap { TaskTag($0.taskDescription) }
  }

  func cancelTasks(of jobId: String) async {
    for task in await session.allTasks where TaskTag(task.taskDescription)?.jobId == jobId {
      task.cancel()
    }
  }

  nonisolated func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    MainActor.assumeIsolated {
      responseBodies[dataTask.taskIdentifier, default: Data()].append(data)
    }
  }

  nonisolated func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didSendBodyData bytesSent: Int64,
    totalBytesSent: Int64,
    totalBytesExpectedToSend: Int64
  ) {
    MainActor.assumeIsolated {
      let previous = lastTotalBytesSent[task.taskIdentifier] ?? 0
      lastTotalBytesSent[task.taskIdentifier] = totalBytesSent
      if totalBytesSent < previous, let tag = TaskTag(task.taskDescription) {
        delegate?.transferRestartedBySystem(tag)
      }
    }
  }

  nonisolated func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    MainActor.assumeIsolated {
      let body = responseBodies.removeValue(forKey: task.taskIdentifier) ?? Data()
      lastTotalBytesSent.removeValue(forKey: task.taskIdentifier)
      guard let tag = TaskTag(task.taskDescription) else { return }
      let response = task.response as? HTTPURLResponse
      delegate?.transfer(
        tag,
        finishedWith: error == nil ? response?.statusCode : nil,
        etag: response?.value(forHTTPHeaderField: "ETag"),
        body: body,
        error: error
      )
    }
  }

  nonisolated func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    MainActor.assumeIsolated {
      delegate?.transfersDrained()
    }
  }
}
