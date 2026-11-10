struct LogThrottle: Sendable {
  let interval: Int

  init(every interval: Int) {
    self.interval = interval
  }

  func allows(_ count: Int) -> Bool {
    count == 1 || count.isMultiple(of: interval)
  }
}
