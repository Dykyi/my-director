func withTimeout(
  seconds: Double,
  throwing timeoutError: some Error & Sendable,
  _ operation: @escaping @Sendable () async throws -> Void
) async throws {
  try await withThrowingTaskGroup(of: Void.self) { group in
    group.addTask { try await operation() }
    group.addTask {
      try await Task.sleep(for: .seconds(seconds))
      throw timeoutError
    }
    defer { group.cancelAll() }
    _ = try await group.next()
  }
}

func poll(
  every interval: Duration,
  timeout: Double,
  isolation: isolated (any Actor)? = #isolation,
  until condition: () async -> Bool
) async throws -> Bool {
  let deadline = HostClock.now() + timeout
  while HostClock.now() < deadline {
    if await condition() { return true }
    try await Task.sleep(for: interval)
  }
  return false
}
