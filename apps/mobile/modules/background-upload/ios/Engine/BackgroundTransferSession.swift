import UIKit

@MainActor
protocol BackgroundTransferDelegate: AnyObject {
  func transfer(_ tag: TaskTag, taskId: Int?, finishedWith status: Int?, etag: String?, body: Data, error: Error?)
  func transferRestartedBySystem(_ tag: TaskTag)
  func transfersDrained()
}

/// Delegate calls arrive on the main queue, so all state here is main-actor state.
@MainActor
final class BackgroundTransferSession: NSObject, URLSessionDataDelegate {
  nonisolated static let identifier = "\(Bundle.main.bundleIdentifier ?? "mydirector").background-upload"
  private static let resourceTimeoutSec: TimeInterval = 24 * 60 * 60
  private static let connectionsPerHost = 4

  private struct PromptRequest {
    var task: Task<Void, Never>
    var backgroundTask: UIBackgroundTaskIdentifier
  }

  weak var delegate: BackgroundTransferDelegate?
  private var responseBodies: [Int: Data] = [:]
  private var lastTotalBytesSent: [Int: Int64] = [:]
  private var promptRequests: [String: PromptRequest] = [:]

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

  /// Creating the session with the same identifier reattaches it to the tasks iOS kept running.
  func activate() {
    _ = session
  }

  /// Returns the session's task identifier, which tells a task apart from an earlier one with the same tag.
  @discardableResult
  func upload(_ request: URLRequest, fromFile file: URL, tag: TaskTag, delaySec: Double) -> Int {
    let task = session.uploadTask(with: request, fromFile: file)
    task.taskDescription = tag.taskDescription
    if delaySec > 0 {
      // Unlike a timer in the app, this survives suspension.
      task.earliestBeginDate = .now.addingTimeInterval(delaySec)
    }
    task.resume()
    return task.taskIdentifier
  }

  /// iOS holds a background-session task created in the background until it sees fit, often until the app is opened.
  /// A short request then goes out on a regular session in the app's background time; true when it went that way.
  func uploadPromptly(_ request: URLRequest, fromFile file: URL, tag: TaskTag, delaySec: Double) -> Bool {
    // A delayed request keeps its start time only in the background session.
    guard delaySec == 0, UIApplication.shared.applicationState == .background else {
      upload(request, fromFile: file, tag: tag, delaySec: delaySec)
      return false
    }
    let name = tag.taskDescription
    let backgroundTask = UIApplication.shared.beginBackgroundTask(withName: name) { [weak self] in
      // Out of time: the background session finishes it whenever iOS lets it.
      guard let self, let task = endPromptRequest(name) else { return }
      task.cancel()
      upload(request, fromFile: file, tag: tag, delaySec: 0)
    }
    let task = Task {
      let (status, body, error) = await Self.send(request, fromFile: file)
      guard endPromptRequest(name) != nil else { return }
      delegate?.transfer(tag, taskId: nil, finishedWith: status, etag: nil, body: body, error: error)
    }
    promptRequests[name] = PromptRequest(task: task, backgroundTask: backgroundTask)
    return true
  }

  /// Tasks whose outcome is still to come. Cancelled ones (by us, or by iOS on force quit) will never upload.
  func liveTags() async -> [TaskTag] {
    await session.allTasks
      .filter { $0.state != .canceling && $0.error?.isCancelledTask != true }
      .compactMap { TaskTag($0.taskDescription) }
  }

  func cancelTasks(of jobId: String) async {
    for task in await session.allTasks where TaskTag(task.taskDescription)?.jobId == jobId {
      task.cancel()
    }
    for name in promptRequests.keys where TaskTag(name)?.jobId == jobId {
      endPromptRequest(name)?.cancel()
    }
  }

  private func endPromptRequest(_ name: String) -> Task<Void, Never>? {
    guard let request = promptRequests.removeValue(forKey: name) else { return nil }
    UIApplication.shared.endBackgroundTask(request.backgroundTask)
    return request.task
  }

  private static func send(_ request: URLRequest, fromFile file: URL) async -> (status: Int?, body: Data, error: Error?) {
    do {
      let (body, response) = try await URLSession.shared.upload(for: request, fromFile: file)
      return ((response as? HTTPURLResponse)?.statusCode, body, nil)
    } catch {
      return (nil, Data(), error)
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
      // The counter went back: nsurlsessiond started the body again after a dropped connection.
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
        taskId: task.taskIdentifier,
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

extension Error {
  var isCancelledTask: Bool { (self as? URLError)?.code == .cancelled }

  /// Why iOS cancelled a background task, when it did: a force quit, Background App Refresh off, or low resources.
  var backgroundCancelReason: String {
    switch (self as NSError).userInfo[NSURLErrorBackgroundTaskCancelledReasonKey] as? Int {
    case NSURLErrorCancelledReasonUserForceQuitApplication: "forceQuit"
    case NSURLErrorCancelledReasonBackgroundUpdatesDisabled: "backgroundUpdatesDisabled"
    case NSURLErrorCancelledReasonInsufficientSystemResources: "insufficientResources"
    case .some(let other): "\(other)"
    case nil: "none"
    }
  }
}
