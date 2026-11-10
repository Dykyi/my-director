@MainActor
final class SerialTaskQueue {
  private var last: Task<Void, Never>?

  nonisolated init() {}

  @discardableResult
  func enqueue(_ work: @escaping @MainActor () async -> Void) -> Task<Void, Never> {
    let previous = last
    let next = Task {
      await previous?.value
      await work()
    }
    last = next
    return next
  }
}
