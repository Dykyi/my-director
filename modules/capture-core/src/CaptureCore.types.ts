export type CameraPosition = 'front' | 'back';
export type RecordingCodec = 'hevc' | 'h264';
export type CallCodec = 'h264' | 'vp8';
export type CallDegradation = 'maintainFramerate' | 'maintainResolution' | 'balanced';
export type StabilizationMode = 'off' | 'standard';
export type ResumePolicy = 'manual' | 'automatic';
export type ThermalLevel = 'nominal' | 'fair' | 'serious' | 'critical';
export type SystemPressureLevel = ThermalLevel | 'shutdown';
export type CallProfileName = 'standard' | 'reduced' | 'minimal';

export type CallVideoProfile = { width: number; height: number; fps: number };

export type CaptureConfig = {
  camera: { position: CameraPosition; width: number; height: number; fps: number; stabilization: StabilizationMode };
  recording: {
    codec: RecordingCodec;
    videoBitrate: number;
    keyFrameIntervalSec: number;
    audioBitrate: number;
    fragmentIntervalSec: number;
    initialFragmentIntervalSec: number;
  };
  call: {
    codec: CallCodec;
    simulcast: boolean;
    degradation: CallDegradation;
    profiles: Record<CallProfileName, CallVideoProfile>;
    thermalProfiles: Record<ThermalLevel, CallProfileName>;
    thermalRecoveryDelaySec: number;
    connectTimeoutSec: number;
  };
  audio: { noiseSuppression: boolean; autoGainControl: boolean; resyncThresholdMs: number };
  session: { resumePolicy: ResumePolicy; heartbeatIntervalSec: number; resumeTimeoutMs: number };
  health: { videoStallMs: number; audioStallMs: number; fileStallMs: number; micRestartGraceMs: number };
  storage: { minFreeSpaceToStartMB: number; lowSpaceWarningMB: number; criticalFreeSpaceMB: number };
};

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type CaptureConfigInput = DeepPartial<CaptureConfig>;

export type CallCredentials = { url: string; token: string };

export type SessionPhase =
  | 'idle' | 'preparing' | 'ready' | 'starting' | 'recording'
  | 'pausing' | 'paused' | 'resuming' | 'stopping';

export type PauseReason =
  | 'user' | 'phoneCall' | 'audioInterrupted' | 'appBackground' | 'screenLocked'
  | 'cameraInterrupted' | 'cameraError' | 'cameraStalled' | 'micStalled'
  | 'fileError' | 'diskFull' | 'mediaServicesReset';

export type InterruptionSource = 'audioSession' | 'camera' | 'appBackground';
export type CallConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
export type CallQuality = 'excellent' | 'good' | 'poor' | 'lost' | 'unknown';

export type CaptureErrorCode =
  | 'permissionDenied' | 'configInvalid' | 'cameraFormatUnsupported' | 'cameraUnavailable'
  | 'cameraStalled' | 'cameraRuntimeError' | 'micUnavailable' | 'audioStalled'
  | 'fileWriterFailed' | 'fileStalled' | 'fileFpsLow' | 'diskSpaceLow' | 'diskFull'
  | 'callConnectFailed' | 'callDisconnected' | 'callPublishFailed'
  | 'mediaServicesReset' | 'resumeBlocked' | 'recoveryUnplayable' | 'invalidState' | 'startInterrupted';

export type CaptureError = { code: CaptureErrorCode; message: string; at: string; recoverable: boolean };
export type CaptureWarning = { code: CaptureErrorCode; message: string; since: string };

export type TrackStatus = 'none' | 'live' | 'muted';

export type ParticipantStatus = {
  identity: string;
  joinedAt?: string;
  quality: CallQuality;
  isSpeaking: boolean;
  microphone: TrackStatus;
  camera: TrackStatus;
};

export type CallStatus = {
  state: CallConnectionState;
  room?: string;
  identity?: string;
  connectedAt?: string;
  reconnectCount: number;
  isMuted: boolean;
  participants: ParticipantStatus[];
  quality: CallQuality;
  profile: CallProfileName;
};

export type SessionSnapshot = {
  phase: SessionPhase;
  sessionId?: string;
  startedAt?: string;
  segmentIndex: number;
  recordedSec: number;
  pauseReason?: PauseReason;
  activeInterruptions: InterruptionSource[];
  call: CallStatus;
  thermal: ThermalLevel;
  error?: CaptureError;
  warnings: CaptureWarning[];
};

export type AudioRoute = { input: string; output: string };

export type HealthSnapshot = {
  at: string;
  camera: { fps: number; width: number; height: number };
  file: { fps: number; droppedFrames: number; bytes: number; segmentSec: number; writer: 'idle' | 'writing' | 'finishing' | 'failed' };
  audio: { levelDb: number; lastBufferAgeMs: number; driftMs: number; resyncCount: number; sampleRate: number };
  call: {
    sentWidth: number;
    sentHeight: number;
    sentFps: number;
    bitrateKbps: number;
    droppedFrames: number;
    qualityLimitation: 'none' | 'cpu' | 'bandwidth' | 'other';
  };
  thermal: ThermalLevel;
  systemPressure: SystemPressureLevel;
  audioRoute: AudioRoute;
  diskFreeBytes: number;
};

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';
export type LogEntry = { at: string; mono: number; level: LogLevel; category: string; message: string; data?: Record<string, string> };

export type SegmentState = 'writing' | 'finalized' | 'recovered' | 'unplayable';
export type SegmentSummary = {
  index: number;
  uri: string;
  state: SegmentState;
  durationSec: number;
  bytes: number;
  pauseReason?: PauseReason;
  failure?: string;
};

export type RecordingState = 'recording' | 'paused' | 'finished' | 'recovered';
export type RecordingSummary = {
  sessionId: string;
  createdAt: string;
  state: RecordingState;
  room?: string;
  segments: SegmentSummary[];
  totalSec: number;
  totalBytes: number;
};

export type RecoveryReport = {
  sessionId: string;
  createdAt: string;
  segments: SegmentSummary[];
  recoveredSec: number;
  knownLossSec: number;
  maxUnseenLossSec: number;
  lastHeartbeatAt?: string;
};

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';
export type PermissionsState = { camera: PermissionStatus; microphone: PermissionStatus };

export type VerificationCheck = { id: string; label: string; expected: string; actual: string; pass: boolean };
export type SegmentVerification = { index: number; uri: string; checks: VerificationCheck[]; pass: boolean };
export type VerificationReport = { sessionId: string; verifiedAt: string; segments: SegmentVerification[]; pass: boolean };

export type CaptureCoreEvents = {
  onStateChange: (snapshot: SessionSnapshot) => void;
  onHealth: (health: HealthSnapshot) => void;
  onLog: (entry: LogEntry) => void;
  onRecoveryFound: (event: { reports: RecoveryReport[] }) => void;
};
