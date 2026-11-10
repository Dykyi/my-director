@MainActor
final class PhaseWaiters {
  private var waiting: [(phases: Set<SessionPhase>, continuation: CheckedContinuation<SessionState, Never>)] = []

  nonisolated init() {}

  func wait(for phases: Set<SessionPhase>, current: SessionState) async -> SessionState {
    if phases.contains(current.phase) { return current }
    return await withCheckedContinuation { waiting.append((phases, $0)) }
  }

  func resume(with state: SessionState) {
    let done = waiting.filter { $0.phases.contains(state.phase) }
    waiting.removeAll { $0.phases.contains(state.phase) }
    done.forEach { $0.continuation.resume(returning: state) }
  }
}
