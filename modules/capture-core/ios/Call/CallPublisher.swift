import Foundation
#if canImport(LiveKit)
import LiveKit
#else
import LiveKitClient
#endif

struct CallCredentials: Equatable, Sendable {
  var url: String
  var token: String
}

@MainActor
final class CallPublisher: NSObject, RoomDelegate {
  private static let connectPollInterval = Duration.milliseconds(100)
  private static let statusRefreshDelay = Duration.milliseconds(250)

  let scaler: CallFrameScaler
  var onStatusChange: ((CallStatus) -> Void)?
  private(set) var status = CallStatus()

  private let log: EventLog
  private var room: Room?
  private var videoTrack: LocalVideoTrack?
  private var credentials: CallCredentials?
  private var call = CaptureConfig.defaults.call
  private var audio = CaptureConfig.defaults.audio
  private var profile = CaptureConfig.defaults.call.profiles.standard
  private var rotationAngle = CameraSource.portraitRotationAngle
  private var quality = CallQuality.unknown
  private var connectedAt: Date?
  private var reconnectCount = 0
  private var isMuted = false
  private var refreshScheduled = false
  private var lastBytesSent: (bytes: UInt64, timestampUs: Double)?
  private var lastBitrateKbps = 0.0

  nonisolated init(log: EventLog) {
    self.log = log
    scaler = CallFrameScaler(profile: CaptureConfig.defaults.call.profiles.standard, log: log)
    super.init()
  }

  func configure(call: CaptureConfig.Call, audio: CaptureConfig.Audio) {
    self.call = call
    self.audio = audio
  }

  func join(_ credentials: CallCredentials, profile: CallVideoProfile, rotationAngle: Double) async throws {
    self.credentials = credentials
    self.profile = profile
    self.rotationAngle = rotationAngle
    scaler.apply(profile)
    let room = Room(delegate: self, connectOptions: nil, roomOptions: RoomOptions(
      defaultAudioCaptureOptions: AudioCaptureOptions(
        echoCancellation: true,
        autoGainControl: audio.autoGainControl,
        noiseSuppression: audio.noiseSuppression
      ),
      adaptiveStream: false,
      dynacast: false,
      suspendLocalVideoTracksInBackground: false
    ))
    self.room = room
    do {
      try await withTimeout(seconds: call.connectTimeoutSec) {
        try await room.connect(url: credentials.url, token: credentials.token)
      }
      connectedAt = Date()
    } catch {
      self.room = nil
      await room.disconnect()
      throw Failure(code: .callConnectFailed, message: (error as? Failure)?.message ?? error.localizedDescription)
    }
    try await publishTracks(in: room)
    refreshStatus()
  }

  func setMuted(_ muted: Bool) async {
    guard let room, let videoTrack else { return }
    do {
      if muted { try await videoTrack.mute() } else { try await videoTrack.unmute() }
      _ = try await room.localParticipant.setMicrophone(enabled: !muted)
      log.info("call", muted ? "Tracks muted" : "Tracks unmuted")
      isMuted = muted
      refreshStatus()
    } catch {
      log.warning("call", "Mute change failed", ["muted": String(muted), "error": error.localizedDescription])
    }
  }

  func ensureJoined(rotationAngle: Double) async throws {
    self.rotationAngle = rotationAngle
    scaler.attach(videoTrack?.capturer as? BufferCapturer, rotationAngle: rotationAngle)
    let state = room?.connectionState
    if state == .connected { return }
    if state == .connecting || state == .reconnecting, await waitUntilConnected(timeout: call.connectTimeoutSec) { return }
    guard let credentials else {
      throw Failure(code: .callConnectFailed, message: "No credentials to rejoin the room")
    }
    log.info("call", "Rejoining the room")
    await leave()
    try await join(credentials, profile: profile, rotationAngle: rotationAngle)
  }

  func apply(_ profile: CallVideoProfile) {
    self.profile = profile
    scaler.apply(profile)
    log.info("call", "Call profile applied", ["video": "\(profile.width)x\(profile.height)@\(profile.fps)"])
  }

  func leave() async {
    scaler.attach(nil, rotationAngle: rotationAngle)
    guard let room else { return }
    self.room = nil
    videoTrack = nil
    lastBytesSent = nil
    lastBitrateKbps = 0
    quality = .unknown
    connectedAt = nil
    reconnectCount = 0
    isMuted = false
    await room.disconnect()
    refreshStatus()
    log.info("call", "Left the room")
  }

  func sendStats() -> HealthSnapshot.Call {
    let dropped = scaler.droppedFrameCount
    guard let stream = videoTrack?.statistics?.outboundRtpStream.first else {
      return HealthSnapshot.Call(sentWidth: 0, sentHeight: 0, sentFps: 0, bitrateKbps: 0, droppedFrames: dropped, qualityLimitation: .none)
    }
    if let bytes = stream.bytesSent, stream.timestamp != lastBytesSent?.timestampUs {
      if let last = lastBytesSent, stream.timestamp > last.timestampUs, bytes >= last.bytes {
        lastBitrateKbps = Double(bytes - last.bytes) * 8 * 1000 / (stream.timestamp - last.timestampUs)
      }
      lastBytesSent = (bytes, stream.timestamp)
    }
    return HealthSnapshot.Call(
      sentWidth: Int(stream.frameWidth ?? 0),
      sentHeight: Int(stream.frameHeight ?? 0),
      sentFps: stream.framesPerSecond ?? 0,
      bitrateKbps: lastBitrateKbps,
      droppedFrames: dropped,
      qualityLimitation: HealthSnapshot.QualityLimitation(rawValue: stream.qualityLimitationReason?.rawValue ?? "none") ?? .other
    )
  }

  private func publishTracks(in room: Room) async throws {
    let track = await LocalVideoTrack.createBufferTrack(
      name: Track.cameraName,
      source: .camera,
      options: BufferCaptureOptions(dimensions: Dimensions(width: Int32(profile.width), height: Int32(profile.height)), fps: profile.fps),
      reportStatistics: true
    )
    scaler.attach(track.capturer as? BufferCapturer, rotationAngle: rotationAngle)
    do {
      _ = try await room.localParticipant.publish(videoTrack: track, options: VideoPublishOptions(
        name: Track.cameraName,
        simulcast: call.simulcast,
        preferredCodec: call.codec == .h264 ? .h264 : .vp8,
        degradationPreference: call.degradation.liveKitPreference
      ))
      _ = try await room.localParticipant.setMicrophone(enabled: true)
    } catch {
      scaler.attach(nil, rotationAngle: rotationAngle)
      throw Failure(code: .callPublishFailed, message: error.localizedDescription)
    }
    videoTrack = track
    log.info("call", "Tracks published", [
      "video": "\(profile.width)x\(profile.height)@\(profile.fps)",
      "codec": call.codec.rawValue,
      "simulcast": String(call.simulcast),
    ])
  }

  private func waitUntilConnected(timeout: Double) async -> Bool {
    let deadline = HostClock.now() + timeout
    while HostClock.now() < deadline {
      if room?.connectionState == .connected { return true }
      try? await Task.sleep(for: Self.connectPollInterval)
    }
    return false
  }

  private func refreshStatus() {
    guard let room else {
      status = CallStatus()
      onStatusChange?(status)
      return
    }
    status = CallStatus(
      state: CallConnectionState(room.connectionState),
      room: room.name,
      identity: room.localParticipant.identity?.stringValue,
      connectedAt: connectedAt,
      reconnectCount: reconnectCount,
      isMuted: isMuted,
      participants: ParticipantStatus.ordered(room.remoteParticipants.values.map(ParticipantStatus.init)),
      quality: quality
    )
    onStatusChange?(status)
  }

  private func scheduleRefresh() {
    guard !refreshScheduled else { return }
    refreshScheduled = true
    Task {
      try? await Task.sleep(for: Self.statusRefreshDelay)
      refreshScheduled = false
      refreshStatus()
    }
  }

  private nonisolated func onMain(of room: Room, _ work: @escaping @MainActor (CallPublisher) -> Void) {
    Task { @MainActor in
      guard room === self.room else { return }
      work(self)
    }
  }

  nonisolated func room(_ room: Room, didUpdateConnectionState connectionState: ConnectionState, from oldConnectionState: ConnectionState) {
    onMain(of: room) { publisher in
      publisher.log.info("call", "Connection state changed", ["to": "\(connectionState)", "from": "\(oldConnectionState)"])
      publisher.refreshStatus()
    }
  }

  nonisolated func room(_ room: Room, didStartReconnectWithMode reconnectMode: ReconnectMode) {
    let mode = "\(reconnectMode)"
    onMain(of: room) { publisher in
      publisher.reconnectCount += 1
      publisher.log.info("call", "Reconnecting", ["mode": mode])
      publisher.refreshStatus()
    }
  }

  nonisolated func room(_ room: Room, participantDidConnect participant: RemoteParticipant) {
    let identity = participant.identity?.stringValue ?? "?"
    onMain(of: room) { publisher in
      publisher.log.info("call", "Participant joined", ["identity": identity])
      publisher.refreshStatus()
    }
  }

  nonisolated func room(_ room: Room, participantDidDisconnect participant: RemoteParticipant) {
    let identity = participant.identity?.stringValue ?? "?"
    onMain(of: room) { publisher in
      publisher.log.info("call", "Participant left", ["identity": identity])
      publisher.refreshStatus()
    }
  }

  nonisolated func room(_ room: Room, participant: Participant, didUpdateConnectionQuality connectionQuality: ConnectionQuality) {
    let quality = CallQuality(connectionQuality)
    let isLocal = participant is LocalParticipant
    onMain(of: room) { publisher in
      guard isLocal else { return publisher.scheduleRefresh() }
      guard quality != publisher.quality else { return }
      publisher.quality = quality
      publisher.log.info("call", "Connection quality changed", ["quality": quality.rawValue])
      publisher.refreshStatus()
    }
  }

  nonisolated func room(_ room: Room, didUpdateSpeakingParticipants participants: [Participant]) {
    onMain(of: room) { $0.scheduleRefresh() }
  }

  nonisolated func room(_ room: Room, participant: RemoteParticipant, didPublishTrack publication: RemoteTrackPublication) {
    onMain(of: room) { $0.scheduleRefresh() }
  }

  nonisolated func room(_ room: Room, participant: RemoteParticipant, didUnpublishTrack publication: RemoteTrackPublication) {
    onMain(of: room) { $0.scheduleRefresh() }
  }

  nonisolated func room(_ room: Room, participant: Participant, trackPublication: TrackPublication, didUpdateIsMuted isMuted: Bool) {
    onMain(of: room) { $0.scheduleRefresh() }
  }

  nonisolated func room(_ room: Room, didDisconnectWithError error: LiveKitError?) {
    let message = error?.localizedDescription ?? "none"
    onMain(of: room) { publisher in
      publisher.log.warning("call", "Room disconnected", ["error": message])
      publisher.refreshStatus()
    }
  }
}

private extension CallConnectionState {
  init(_ state: ConnectionState) {
    switch state {
    case .connected: self = .connected
    case .connecting: self = .connecting
    case .reconnecting: self = .reconnecting
    default: self = .disconnected
    }
  }
}

private extension CallQuality {
  init(_ quality: ConnectionQuality) {
    switch quality {
    case .excellent: self = .excellent
    case .good: self = .good
    case .poor: self = .poor
    case .lost: self = .lost
    default: self = .unknown
    }
  }
}

private extension CallDegradation {
  var liveKitPreference: DegradationPreference {
    switch self {
    case .maintainFramerate: .maintainFramerate
    case .maintainResolution: .maintainResolution
    case .balanced: .balanced
    }
  }
}

private func withTimeout(seconds: Double, _ operation: @escaping @Sendable () async throws -> Void) async throws {
  try await withThrowingTaskGroup(of: Void.self) { group in
    group.addTask { try await operation() }
    group.addTask {
      try await Task.sleep(for: .seconds(seconds))
      throw Failure(code: .callConnectFailed, message: "No connection after \(Int(seconds)) s")
    }
    defer { group.cancelAll() }
    _ = try await group.next()
  }
}

private extension ParticipantStatus {
  init(_ participant: RemoteParticipant) {
    let publications = participant.trackPublications.values
    self.init(
      identity: participant.identity?.stringValue ?? "?",
      joinedAt: participant.joinedAt,
      quality: CallQuality(participant.connectionQuality),
      isSpeaking: participant.isSpeaking,
      microphone: TrackStatus(isMuted: publications.first { $0.source == .microphone }?.isMuted),
      camera: TrackStatus(isMuted: publications.first { $0.source == .camera }?.isMuted)
    )
  }
}
