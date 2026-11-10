/// Send rate from WebRTC's byte counter, keyed by WebRTC's own timestamp in microseconds:
/// polls come from several timers, while LiveKit refreshes the stats once a second.
struct BitrateMeter: Sendable {
  private var last: (bytes: UInt64, timestampUs: Double)?
  private(set) var kbps = 0.0

  mutating func update(bytesSent: UInt64, timestampUs: Double) -> Double {
    guard timestampUs != last?.timestampUs else { return kbps }
    if let last, timestampUs > last.timestampUs, bytesSent >= last.bytes {
      kbps = Double(bytesSent - last.bytes) * 8 * 1000 / (timestampUs - last.timestampUs)
    }
    last = (bytesSent, timestampUs)
    return kbps
  }
}
