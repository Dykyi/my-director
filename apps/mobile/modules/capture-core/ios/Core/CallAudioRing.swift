struct CallAudioRing: Sendable {
  struct Slice: Equatable, Sendable {
    var samples: [Int16]
    var covered: Int
  }

  private let sampleRate: Double
  private var storage: [Int16]
  private var written: [Bool]
  private var firstFrame: Int64?
  private var endFrame: Int64 = 0

  init(sampleRate: Double, capacitySec: Double) {
    self.sampleRate = sampleRate
    storage = Array(repeating: 0, count: Int((sampleRate * capacitySec).rounded()))
    written = Array(repeating: false, count: storage.count)
  }

  var endTime: Double? { firstFrame == nil ? nil : Double(endFrame) / sampleRate }

  mutating func write(_ samples: UnsafeBufferPointer<Int16>, at time: Double) {
    let start = frame(time)
    let end = start + Int64(samples.count)
    if firstFrame == nil { endFrame = start }
    firstFrame = min(firstFrame ?? start, start)
    let newEnd = max(endFrame, end)
    let keptFrom = newEnd - capacity
    // A gap stays silent instead of replaying audio from a lap ago.
    for position in stride(from: max(endFrame, keptFrom), to: start, by: 1) {
      storage[slot(position)] = 0
      written[slot(position)] = false
    }
    for position in stride(from: max(start, keptFrom), to: end, by: 1) {
      storage[slot(position)] = samples[Int(position - start)]
      written[slot(position)] = true
    }
    endFrame = newEnd
  }

  func read(from time: Double, count: Int) -> Slice {
    var slice = Slice(samples: Array(repeating: 0, count: count), covered: 0)
    guard let firstFrame else { return slice }
    let start = frame(time)
    let valid = max(firstFrame, endFrame - capacity)..<endFrame
    for index in 0..<count where valid.contains(start + Int64(index)) {
      let cell = slot(start + Int64(index))
      slice.samples[index] = storage[cell]
      if written[cell] { slice.covered += 1 }
    }
    return slice
  }

  private var capacity: Int64 { Int64(storage.count) }

  private func frame(_ time: Double) -> Int64 {
    Int64((time * sampleRate).rounded())
  }

  private func slot(_ position: Int64) -> Int {
    Int((position % capacity + capacity) % capacity)
  }
}
