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
  private static let pauseReasonAttribute = "pauseReason"
  private nonisolated static let defaultProfile = CaptureConfig.defaults.call.profiles.standard
  private static let connectPollInterval = Duration.milliseconds(100)
  /// Status events come in bursts; one update per this delay is enough for the screen.
  private static let statusRefreshDelay = Duration.milliseconds(250)

  private struct Joined {
    let room: Room
    var videoTrack: LocalVideoTrack?
    var connectedAt: Date?
    var reconnectCount = 0
    var isMuted = false
    var quality = CallQuality.unknown
    var bitrate = BitrateMeter()
  }

  let scaler: CallFrameScaler
  var onStatusChange: ((CallStatus) -> Void)?
  private(set) var status = CallStatus()

  private let log: EventLog
  private let muteChanges = SerialTaskQueue()
  private var joined: Joined?
  private var credentials: CallCredentials?
  private var callConfig = CaptureConfig.defaults.call
  private var audio = CaptureConfig.defaults.audio
  private var profile = defaultProfile
  private var rotationAngle = CameraSource.portraitRotationAngle
  private var refreshScheduled = false

  nonisolated init(log: EventLog) {
    self.log = log
    scaler = CallFrameScaler(profile: Self.defaultProfile, log: log)
    super.init()
  }

  func configure(call: CaptureConfig.Call, audio: CaptureConfig.Audio) {
    callConfig = call
    self.audio = audio
  }

  func join(_ credentials: CallCredentials, profile: CallVideoProfile, rotationAngle: Double, publish: Bool = true) async throws {
    self.credentials = credentials
    self.profile = profile
    self.rotationAngle = rotationAngle
    scaler.apply(profile)
    let room = try await connect(credentials)
    if publish { try await publishTracks(in: room) }
    refreshStatus()
  }

  private func connect(_ credentials: CallCredentials) async throws -> Room {
    let room = Room(delegate: self, connectOptions: nil, roomOptions: RoomOptions(
      defaultAudioCaptureOptions: AudioCaptureOptions(
        echoCancellation: true,
        autoGainControl: audio.autoGainControl,
        noiseSuppression: audio.noiseSuppression
      ),
      adaptiveStream: false,
      dynacast: false,
      // Backgrounding pauses the session; LiveKit's own suspension would fight that.
      suspendLocalVideoTracksInBackground: false
    ))
    joined = Joined(room: room)
    do {
      let timeout = callConfig.connectTimeoutSec
      let timedOut = Failure(code: .callConnectFailed, message: "No connection after \(Int(timeout)) s")
      // Room.connect has no timeout of its own.
      try await withTimeout(seconds: timeout, throwing: timedOut) {
        try await room.connect(url: credentials.url, token: credentials.token)
      }
    } catch {
      await abandon(room)
      throw Failure(code: .callConnectFailed, message: (error as? Failure)?.message ?? error.localizedDescription)
    }
    if joined?.room === room { joined?.connectedAt = Date() }
    return room
  }

  private func abandon(_ room: Room) async {
    if joined?.room === room { joined = nil }
    await room.disconnect()
    refreshStatus()
  }

  /// Changes run one at a time, so a Resume cancelled mid-unmute still ends muted.
  func setMuted(_ muted: Bool, reason: PauseReason?) async {
    await muteChanges.enqueue { await self.changeMute(muted, reason: reason) }.value
  }

  /// The reason goes first, so the interviewer page can say why before the picture goes dark.
  private func changeMute(_ muted: Bool, reason: PauseReason?) async {
    guard let room = joined?.room else { return }
    await sharePauseReason(muted ? reason : nil, in: room)
    do {
      if let videoTrack = joined?.videoTrack {
        if muted { try await videoTrack.mute() } else { try await videoTrack.unmute() }
        _ = try await room.localParticipant.setMicrophone(enabled: !muted)
      }
      log.info("call", muted ? "Tracks muted" : "Tracks unmuted")
      if joined?.room === room { joined?.isMuted = muted }
      refreshStatus()
    } catch {
      log.warning("call", "Mute change failed", ["muted": String(muted), "error": error.localizedDescription])
    }
  }

  /// The interviewer page reads this attribute. Needs `canUpdateOwnMetadata` in the token.
  private func sharePauseReason(_ reason: PauseReason?, in room: Room) async {
    do {
      try await room.localParticipant.set(attributes: [Self.pauseReasonAttribute: reason?.rawValue ?? ""])
    } catch {
      log.warning("call", "Pause reason not shared", ["error": error.localizedDescription])
    }
  }

  func ensureJoined(rotationAngle: Double, publish: Bool) async throws {
    self.rotationAngle = rotationAngle
    scaler.attach(joined?.videoTrack?.capturer as? BufferCapturer, rotationAngle: rotationAngle)
    if try await staysConnected() { return try await publishIfMissing(publish) }
    guard let credentials else {
      throw Failure(code: .callConnectFailed, message: "No credentials to rejoin the room")
    }
    log.info("call", "Rejoining the room")
    await leave()
    try await join(credentials, profile: profile, rotationAngle: rotationAngle, publish: publish)
  }

  private func staysConnected() async throws -> Bool {
    switch RejoinPlan(connection: joined.map { CallConnectionState($0.room.connectionState) }) {
    case .keep: return true
    case .waitForReconnect: return try await waitUntilConnected(timeout: callConfig.connectTimeoutSec)
    case .rejoin: return false
    }
  }

  private func publishIfMissing(_ publish: Bool) async throws {
    guard publish, let joined, joined.videoTrack == nil else { return }
    try await publishTracks(in: joined.room)
    refreshStatus()
  }

  func apply(_ profile: CallVideoProfile) {
    self.profile = profile
    scaler.apply(profile)
    log.info("call", "Call profile applied", ["video": "\(profile.width)x\(profile.height)@\(profile.fps)"])
  }

  func leave() async {
    scaler.attach(nil, rotationAngle: rotationAngle)
    guard let room = joined?.room else { return }
    joined = nil
    await room.disconnect()
    refreshStatus()
    log.info("call", "Left the room")
  }

  func outboundVideoStats() -> HealthSnapshot.Call {
    let dropped = scaler.droppedFrameCount
    guard let stream = joined?.videoTrack?.statistics?.outboundRtpStream.first else { return .idle(droppedFrames: dropped) }
    if let bytes = stream.bytesSent { joined?.bitrate.update(bytesSent: bytes, timestampUs: stream.timestamp) }
    let kbps = joined?.bitrate.kbps ?? 0
    return HealthSnapshot.Call(
      sentWidth: Int(stream.frameWidth ?? 0),
      sentHeight: Int(stream.frameHeight ?? 0),
      sentFps: stream.framesPerSecond ?? 0,
      bitrateKbps: kbps,
      droppedFrames: dropped,
      qualityLimitation: HealthSnapshot.QualityLimitation(webRTCReason: stream.qualityLimitationReason?.rawValue)
    )
  }

  private func publishTracks(in room: Room) async throws {
    let track = await LocalVideoTrack.createBufferTrack(
      name: Track.cameraName,
      source: .camera,
      options: BufferCaptureOptions(dimensions: Dimensions(width: Int32(profile.width), height: Int32(profile.height)), fps: profile.fps),
      reportStatistics: true
    )
    // publish(videoTrack:) waits for the capturer's first frame to learn its size, so frames flow before it.
    scaler.attach(track.capturer as? BufferCapturer, rotationAngle: rotationAngle)
    do {
      _ = try await room.localParticipant.publish(videoTrack: track, options: VideoPublishOptions(
        name: Track.cameraName,
        simulcast: callConfig.simulcast,
        preferredCodec: callConfig.codec == .h264 ? .h264 : .vp8,
        degradationPreference: callConfig.degradation.liveKitPreference
      ))
      _ = try await room.localParticipant.setMicrophone(enabled: true)
    } catch {
      scaler.attach(nil, rotationAngle: rotationAngle)
      await abandon(room)
      throw Failure(code: .callPublishFailed, message: error.localizedDescription)
    }
    if joined?.room === room { joined?.videoTrack = track }
    log.info("call", "Tracks published", [
      "video": "\(profile.width)x\(profile.height)@\(profile.fps)",
      "codec": callConfig.codec.rawValue,
      "simulcast": String(callConfig.simulcast),
    ])
  }

  private func waitUntilConnected(timeout: Double) async throws -> Bool {
    try await poll(every: Self.connectPollInterval, timeout: timeout) { joined?.room.connectionState == .connected }
  }

  private func refreshStatus() {
    guard let joined else {
      status = CallStatus()
      onStatusChange?(status)
      return
    }
    let room = joined.room
    status = CallStatus(
      state: CallConnectionState(room.connectionState),
      room: room.name,
      identity: room.localParticipant.identity?.stringValue,
      connectedAt: joined.connectedAt,
      reconnectCount: joined.reconnectCount,
      isMuted: joined.isMuted,
      participants: ParticipantStatus.ordered(room.remoteParticipants.values.map(ParticipantStatus.init)),
      quality: joined.quality
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

  /// Delegate callbacks arrive off the main actor; events of a room already left are dropped.
  private nonisolated func onMain(of room: Room, _ work: @escaping @MainActor (CallPublisher) -> Void) {
    Task { @MainActor in
      guard room === self.joined?.room else { return }
      work(self)
    }
  }

  nonisolated func room(_ room: Room, didUpdateConnectionState connectionState: ConnectionState, from oldConnectionState: ConnectionState) {
    onMain(of: room) { publisher in
      publisher.log.info("call", "Connection state changed", ["to": "\(connectionState)", "from": "\(oldConnectionState)"])
      publisher.refreshStatus()
    }
  }

  /// `didUpdateConnectionState` misses quick reconnects (LiveKit RoomDelegate docs), so reconnects are counted here.
  nonisolated func room(_ room: Room, didStartReconnectWithMode reconnectMode: ReconnectMode) {
    let mode = "\(reconnectMode)"
    onMain(of: room) { publisher in
      publisher.joined?.reconnectCount += 1
      publisher.log.info("call", "Reconnecting", ["mode": mode])
      publisher.refreshStatus()
    }
  }

  nonisolated func room(_ room: Room, didCompleteReconnectWithMode reconnectMode: ReconnectMode) {
    let mode = "\(reconnectMode)"
    onMain(of: room) { publisher in
      publisher.log.info("call", "Reconnected", ["mode": mode])
      publisher.refreshStatus()
    }
  }

  nonisolated func room(_ room: Room, participantDidConnect participant: RemoteParticipant) {
    let identity = participant.displayIdentity
    onMain(of: room) { publisher in
      publisher.log.info("call", "Participant joined", ["identity": identity])
      publisher.refreshStatus()
    }
  }

  nonisolated func room(_ room: Room, participantDidDisconnect participant: RemoteParticipant) {
    let identity = participant.displayIdentity
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
      guard quality != publisher.joined?.quality else { return }
      publisher.joined?.quality = quality
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
