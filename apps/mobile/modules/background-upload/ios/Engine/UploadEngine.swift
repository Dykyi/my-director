import Foundation

@MainActor
final class UploadEngine: BackgroundTransferDelegate {
  static let shared = UploadEngine()
  /// Slicing needs a second copy of the file; the headroom keeps the phone usable meanwhile.
  static let requiredHeadroomBytes: Int64 = 200 * bytesPerMebibyte
  private static let loggedBodyLimit = 512

  var onChange: ((UploadSnapshot) -> Void)?

  private let store = UploadJobStore(root: URL.applicationSupportDirectory.appending(path: "uploads", directoryHint: .isDirectory))
  private let log: UploadEventLog
  private let transfers = BackgroundTransferSession()
  private var jobs: [String: UploadJob] = [:]
  private var activation: Task<Void, Never>?
  private var cancellations: [String: Task<Void, Never>] = [:]
  private var systemCompletionHandler: (() -> Void)?

  private init() {
    log = UploadEventLog(store: store)
    transfers.delegate = self
  }

  /// Idempotent: the module's OnCreate and a background relaunch both call it.
  func activate() async {
    let activation = activation ?? Task {
      let (loaded, unreadable) = store.loadAll()
      unreadable.forEach { log.append($0, "job.unreadable") }
      jobs = Dictionary(uniqueKeysWithValues: loaded.map { ($0.id, $0) })
      transfers.activate()
      await reconcile()
    }
    self.activation = activation
    await activation.value
  }

  /// iOS relaunched the app for the session; its completion handler runs once the session has delivered every event.
  func handleBackgroundEvents(completionHandler: @escaping () -> Void) {
    systemCompletionHandler = completionHandler
    Task { await activate() }
  }

  func snapshots() -> [UploadSnapshot] {
    jobs.values.sorted { $0.updatedAt > $1.updatedAt }.map(UploadSnapshot.init)
  }

  /// Bad input throws to JS. Once the job exists, a failure is shown as a failed job instead.
  func start(_ input: StartUploadInput) async throws -> UploadSnapshot {
    await activate()
    guard let file = URL(string: input.fileUri), file.isFileURL else { throw UploadEngineError.invalidFileUri(input.fileUri) }
    let fileSize = Int64(try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0)
    let plan = try UploadPlan(fileSize: fileSize, partSize: UploadPlan.partSize)
    let freeBytes = try URL.documentsDirectory
      .resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
      .volumeAvailableCapacityForImportantUsage ?? 0
    guard freeBytes >= fileSize + Self.requiredHeadroomBytes else {
      throw UploadEngineError.notEnoughSpace(neededBytes: fileSize + Self.requiredHeadroomBytes, freeBytes: freeBytes)
    }

    let job = UploadJob(
      id: UUID().uuidString,
      fileUri: input.fileUri,
      objectKey: input.objectKey,
      api: input.api,
      maxAttemptsPerPart: UploadJob.maxAttempts,
      bytesTotal: fileSize,
      updatedAt: .now
    )
    try store.prepare(job.id)
    insert(job)
    log.append(job.id, "job.created", ["key": job.objectKey, "bytes": "\(fileSize)", "parts": "\(plan.partCount)"])

    do {
      let partsDirectory = store.partsDirectory(for: job.id)
      let sliced = try await Task.detached(priority: .userInitiated) {
        try PartSlicer.slice(file: file, plan: plan, into: partsDirectory)
      }.value
      let created = try await UploadApiClient(api: input.api).createUpload(
        CreateUploadRequest(key: input.objectKey, size: fileSize, partSize: plan.partSize, partMd5s: sliced.map(\.md5Base64))
      )
      let parts = try UploadJob.Part.planned(sliced: sliced, signed: created.parts)
      log.append(job.id, "job.planned", ["uploadId": created.uploadId, "expiresAt": created.expiresAt])
      apply(.planned(uploadId: created.uploadId, parts: parts), to: job.id)
    } catch {
      log.append(job.id, "job.preparationFailed", ["error": error.localizedDescription])
      apply(.preparationFailed(error.localizedDescription), to: job.id)
    }
    return UploadSnapshot(jobs[job.id] ?? job)
  }

  func retryFailedParts(id: String) async throws {
    guard jobs[id] != nil else { throw UploadEngineError.unknownUpload(id) }
    // A retry must not race the cancellation of the failed attempt's tasks.
    await cancellations.removeValue(forKey: id)?.value
    log.append(id, "job.retryRequested")
    apply(.retryFailedRequested, to: id)
  }

  func cancel(id: String) async throws {
    guard jobs[id] != nil else { throw UploadEngineError.unknownUpload(id) }
    apply(.cancelRequested, to: id)
    guard let job = jobs[id], job.phase == .cancelled else { return }
    await cancellations.removeValue(forKey: id)?.value
    removeParts(of: id)
    log.append(id, "job.cancelled")
    guard let uploadId = job.uploadId else { return }
    await abort(uploadId: uploadId, of: job)
  }

  private func abort(uploadId: String, of job: UploadJob) async {
    do {
      try await UploadApiClient(api: job.api).abortUpload(uploadId: uploadId, key: job.objectKey)
    } catch {
      log.append(job.id, "job.abortFailed", ["error": error.localizedDescription])
    }
  }

  func transfer(_ tag: TaskTag, finishedWith status: Int?, etag: String?, body: Data, error: Error?) {
    // Our own cancellations and iOS cancelling on force quit: reconcile restarts whatever is still needed.
    if error?.isCancelledTask == true {
      log.append(tag.jobId, "task.cancelled", ["task": tag.taskDescription])
      return
    }
    guard let job = jobs[tag.jobId] else { return }
    let reason = error?.localizedDescription
    let statusText = status.map(String.init) ?? "none"
    guard job.isCurrent(tag) else {
      log.append(job.id, "task.stale", ["task": tag.taskDescription])
      return
    }
    switch tag.kind {
    case .part(let number, let attempt):
      log.append(job.id, "part.finished", ["part": "\(number)", "attempt": "\(attempt)", "status": statusText, "error": reason ?? "none"])
      apply(.partFinished(number: number, status: status, etag: etag, error: reason), to: job.id)
    case .complete:
      let text = String(decoding: body.prefix(Self.loggedBodyLimit), as: UTF8.self)
      log.append(job.id, "complete.finished", ["status": statusText, "body": text, "error": reason ?? "none"])
      let response = try? JSONDecoder().decode(CompleteUploadResponse.self, from: body)
      apply(.completeFinished(status: status, response: response, error: reason), to: job.id)
    }
  }

  func transferRestartedBySystem(_ tag: TaskTag) {
    log.append(tag.jobId, "part.restartedBySystem", ["task": tag.taskDescription])
  }

  func transfersDrained() {
    systemCompletionHandler?()
    systemCompletionHandler = nil
  }

  /// After a relaunch, parts the job counts as in flight but the session no longer runs are started again.
  /// If iOS no longer lists a task that finished while the app was dead, that part is sent once more: same bytes, same ETag.
  private func reconcile() async {
    for job in jobs.values where job.phase == .preparing {
      apply(.preparationFailed("The app stopped while the file was being prepared"), to: job.id)
    }
    let live = await transfers.liveTags()
    for job in jobs.values where job.phase == .uploading || job.phase == .completing {
      let tags = live.filter { $0.jobId == job.id }
      log.append(job.id, "job.reconciled", ["liveTasks": "\(tags.count)"])
      let partNumbers = Set(tags.compactMap(\.partNumber))
      apply(.reconciled(livePartNumbers: partNumbers, completeIsLive: tags.contains { $0.partNumber == nil }), to: job.id)
    }
  }

  private func insert(_ job: UploadJob) {
    jobs[job.id] = job
    save(job)
    onChange?(UploadSnapshot(job))
  }

  private func apply(_ event: UploadEvent, to id: String) {
    guard var job = jobs[id] else { return }
    let commands = job.handle(event, at: .now)
    jobs[id] = job
    save(job)
    commands.forEach { perform($0, for: job) }
    onChange?(UploadSnapshot(job))
  }

  private func perform(_ command: UploadCommand, for job: UploadJob) {
    switch command {
    case .startPart(let number, let delaySec):
      guard let part = job.parts.first(where: { $0.number == number }), let url = URL(string: part.url) else { return }
      var request = URLRequest(url: url)
      request.httpMethod = "PUT"
      part.headers.forEach { request.setValue($1, forHTTPHeaderField: $0) }
      let tag = TaskTag(jobId: job.id, kind: .part(number: number, attempt: part.attempt))
      transfers.upload(request, fromFile: store.partURL(jobId: job.id, number: number), tag: tag, delaySec: delaySec)
      if part.attempt > 0 {
        log.append(job.id, "part.retry", ["part": "\(number)", "attempt": "\(part.attempt)", "delaySec": "\(delaySec)"])
      }

    case .checkDigest(let number):
      let file = store.partURL(jobId: job.id, number: number)
      let expected = job.parts.first { $0.number == number }?.md5
      Task {
        let actual = try? await Task.detached { try PartSlicer.md5Base64(of: file) }.value
        log.append(job.id, "part.digestChecked", ["part": "\(number)", "matches": "\(actual == expected)"])
        apply(.digestChecked(number: number, matches: actual == expected), to: job.id)
      }

    case .startComplete(let delaySec):
      guard let uploadId = job.uploadId else { return assertionFailure("A completing job always has an upload id") }
      do {
        let body = store.completeURL(for: job.id)
        try store.write(UploadCoding.encoder().encode(job.completeRequest), to: body)
        let request = try UploadApiClient(api: job.api).completeRequest(uploadId: uploadId)
        let tag = TaskTag(jobId: job.id, kind: .complete(attempt: job.completeAttempt))
        let regularSession = transfers.uploadPromptly(request, fromFile: body, tag: tag, delaySec: delaySec)
        log.append(job.id, "complete.started", ["attempt": "\(job.completeAttempt)", "delaySec": "\(delaySec)", "regularSession": "\(regularSession)"])
      } catch {
        // Reported after the current event finishes, so two reducer steps never interleave.
        Task { apply(.completeFinished(status: nil, response: nil, error: error.localizedDescription), to: job.id) }
      }

    case .cancelTasks:
      cancellations[job.id] = Task { await transfers.cancelTasks(of: job.id) }

    case .finishVerified:
      removeParts(of: job.id)
      log.append(job.id, "job.verified", ["serverSize": "\(job.serverSize ?? 0)"])
      UploadNotifier.post(id: job.id, title: "Upload verified", body: job.verifiedSummary)

    case .finishFailed:
      log.append(job.id, "job.failed", ["error": job.error ?? ""])
      UploadNotifier.post(id: job.id, title: "Upload failed", body: job.error ?? job.objectKey)

    case .discardParts:
      removeParts(of: job.id)

    case .abortUpload(let uploadId):
      Task { await abort(uploadId: uploadId, of: job) }
    }
  }

  private func save(_ job: UploadJob) {
    do {
      try store.save(job)
    } catch {
      log.append(job.id, "job.saveFailed", ["error": error.localizedDescription])
    }
  }

  private func removeParts(of id: String) {
    do {
      try store.removeParts(of: id)
    } catch {
      log.append(id, "parts.removeFailed", ["error": error.localizedDescription])
    }
  }
}
