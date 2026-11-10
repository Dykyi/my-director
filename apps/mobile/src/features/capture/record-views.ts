import type {
  CallProfileName,
  CallVideoProfile,
  CaptureConfig,
  HealthSnapshot,
  PauseReason,
  SessionPhase,
  SessionSnapshot,
} from '@modules/capture-core';

import { formatBytes, formatResolution, formatTimer, profileLabel } from '@shared/format';
import { BITS_PER_BYTE, SECONDS_PER_HOUR } from '@shared/units';
import type { ChipView } from '@ui/tone';

import { participantNames, QUALITY_LOOK, type QualityLook } from './call-labels';
import { CAMERA_LABEL } from './camera-preference';
import { litBars } from './mic-level';
import { ERROR_TITLE, PAUSE_REASON, PHASE_PILL } from './session-labels';

export type CallRowView = {
  title: string;
  detail: string;
  inCall: boolean;
  chip: QualityLook | ChipView;
};
type RecStripView = {
  tone: 'recording' | 'paused';
  label: string;
  time: string;
  detail: string;
};

export function headerFact(
  { phase, sessionId, segmentIndex }: SessionSnapshot,
  health: HealthSnapshot | null,
  recording: CaptureConfig['recording'],
): string {
  if (phase === 'paused') return `seg ${segmentIndex} saved`;
  if (sessionId !== undefined) {
    return health
      ? `seg ${segmentIndex} · ${formatBytes(health.file.bytes)}`
      : `seg ${segmentIndex}`;
  }
  if (!health) return '';
  const bytesPerHour =
    ((recording.videoBitrate + recording.audioBitrate) / BITS_PER_BYTE) * SECONDS_PER_HOUR;
  const hours = Math.floor(health.diskFreeBytes / bytesPerHour);
  return `${formatBytes(health.diskFreeBytes)} free · about ${hours} h`;
}

function connectedView(
  call: SessionSnapshot['call'],
  profiles: Record<CallProfileName, CallVideoProfile>,
  room: string,
): CallRowView {
  const [first, ...others] = participantNames(call);
  if (first === undefined) {
    return {
      title: `Room ${room}`,
      detail: 'Nobody else here yet',
      inCall: true,
      chip: { label: 'waiting', tone: 'paused' },
    };
  }
  const title = others.length > 0 ? `${first} +${others.length}` : first;
  if (call.isMuted) {
    return {
      title,
      detail: 'Still in the room · your camera and mic are muted',
      inCall: false,
      chip: { label: 'muted', tone: 'paused' },
    };
  }
  const { height, fps } = profiles[call.profile];
  return {
    title,
    detail: `${room} · you send ${profileLabel({ height, fps })}`,
    inCall: true,
    chip: QUALITY_LOOK[call.quality],
  };
}

export function callRowView(
  { sessionId, call }: SessionSnapshot,
  profiles: Record<CallProfileName, CallVideoProfile>,
  room: string,
): CallRowView {
  const roomTitle = `Room ${room}`;
  if (sessionId === undefined) {
    return {
      title: roomTitle,
      detail: 'You join the call when recording starts',
      inCall: false,
      chip: { label: 'not joined', tone: 'neutral' },
    };
  }
  switch (call.state) {
    case 'connecting':
      return {
        title: roomTitle,
        detail: 'Joining the call…',
        inCall: false,
        chip: { label: 'joining', tone: 'neutral' },
      };
    case 'reconnecting':
      return {
        title: roomTitle,
        detail: 'Reconnecting. Recording continues on the phone',
        inCall: false,
        chip: { label: 'reconnecting', tone: 'paused' },
      };
    case 'disconnected':
      return {
        title: roomTitle,
        detail: 'Call dropped. Recording continues on the phone',
        inCall: false,
        chip: QUALITY_LOOK.lost,
      };
    case 'connected':
      return connectedView(call, profiles, room);
  }
}

export function previewCaption({ position, width, height, fps }: CaptureConfig['camera']): string {
  return `${CAMERA_LABEL[position]} camera · ${formatResolution(width, height)} · ${fps} fps`;
}

export const recChipText = ({ file }: HealthSnapshot) => `REC ${file.fps.toFixed(0)} fps`;

export const micChip = ({ audio }: HealthSnapshot) => ({
  lit: litBars(audio.levelDb),
  level: `${Math.round(audio.levelDb)} dB`,
});

export function pausedView(reason: PauseReason, segmentIndex: number) {
  const { icon, title, detail } = PAUSE_REASON[reason];
  return {
    icon,
    title,
    text: `${detail} Segment ${segmentIndex} is closed and safe on disk. Resume starts segment ${segmentIndex + 1} in the same room.`,
  };
}

export function recStripView({ phase, recordedSec, segmentIndex }: SessionSnapshot): RecStripView {
  const time = formatTimer(recordedSec);
  return PHASE_PILL[phase].tone === 'paused'
    ? { tone: 'paused', label: 'PAUSED', time, detail: `· seg ${segmentIndex} saved` }
    : { tone: 'recording', label: 'REC', time, detail: `· seg ${segmentIndex}` };
}

const RECONNECT_PHASES: ReadonlySet<SessionPhase> = new Set(['recording', 'paused']);

export const canReconnectCall = ({ phase, call }: SessionSnapshot) =>
  RECONNECT_PHASES.has(phase) && call.state === 'disconnected';

export type RecordNoticesView = {
  error?: { title: string; message: string; openSettings: boolean };
  warnings: string[];
};

export function recordNotices(
  { error, warnings }: SessionSnapshot,
  commandError: string | null,
): RecordNoticesView | null {
  if (!error && !commandError && warnings.length === 0) return null;
  return {
    error: error
      ? {
          title: ERROR_TITLE[error.code],
          message: error.message,
          openSettings: error.code === 'permissionDenied',
        }
      : commandError
        ? { title: 'Command failed', message: commandError, openSettings: false }
        : undefined,
    warnings: warnings.map((warning) => warning.message),
  };
}
