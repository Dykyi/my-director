import type { CallStatus, PauseReason, SessionPhase } from '@modules/capture-core';

import type { IconName } from '@ui/icons';
import type { PillTone } from '@ui/status-pill';
import type { TextTone } from '@ui/tone';

export const PHASE_PILL: Record<SessionPhase, { label: string; tone: PillTone }> = {
  idle: { label: 'CAMERA OFF', tone: 'neutral' },
  preparing: { label: 'STARTING', tone: 'neutral' },
  ready: { label: 'READY', tone: 'neutral' },
  starting: { label: 'CONNECTING', tone: 'neutral' },
  recording: { label: 'RECORDING', tone: 'recording' },
  pausing: { label: 'PAUSING', tone: 'paused' },
  paused: { label: 'PAUSED', tone: 'paused' },
  resuming: { label: 'RESUMING', tone: 'paused' },
  stopping: { label: 'SAVING', tone: 'neutral' },
};

export const PHASE_PROGRESS: Partial<Record<SessionPhase, string>> = {
  preparing: 'Starting camera…',
  starting: 'Connecting…',
  pausing: 'Pausing…',
  resuming: 'Resuming…',
  stopping: 'Finishing file…',
};

export const PAUSE_REASON: Record<
  PauseReason,
  { label: string; title: string; icon: IconName; detail: string; isFault: boolean }
> = {
  user: {
    label: 'by you',
    title: 'Paused by you',
    icon: 'pause-circle',
    detail: 'You paused the recording.',
    isFault: false,
  },
  phoneCall: {
    label: 'phone call',
    title: 'Paused for a phone call',
    icon: 'phone',
    detail: 'iOS took the microphone for the call.',
    isFault: false,
  },
  audioInterrupted: {
    label: 'audio taken',
    title: 'Paused: another app took the audio',
    icon: 'volume-off',
    detail: 'Another app took the audio.',
    isFault: false,
  },
  appBackground: {
    label: 'in background',
    title: 'Paused in the background',
    icon: 'home',
    detail: 'The app went to the background, where iOS stops the camera.',
    isFault: false,
  },
  screenLocked: {
    label: 'screen locked',
    title: 'Paused: the screen locked',
    icon: 'lock',
    detail: 'The screen locked, and iOS stopped the camera.',
    isFault: false,
  },
  cameraInterrupted: {
    label: 'camera taken',
    title: 'Paused: the camera was taken',
    icon: 'video-off',
    detail: 'iOS gave the camera to something else.',
    isFault: false,
  },
  cameraError: {
    label: 'camera error',
    title: 'Paused: camera error',
    icon: 'warning',
    detail: 'The camera reported an error.',
    isFault: true,
  },
  cameraStalled: {
    label: 'camera stopped',
    title: 'Paused: the camera stopped',
    icon: 'video-off',
    detail: 'The camera stopped delivering frames.',
    isFault: true,
  },
  micStalled: {
    label: 'mic stopped',
    title: 'Paused: the microphone stopped',
    icon: 'mic-off',
    detail: 'The microphone stopped delivering audio.',
    isFault: true,
  },
  fileError: {
    label: 'file error',
    title: 'Paused: the file failed',
    icon: 'disk',
    detail: 'Writing the file failed.',
    isFault: true,
  },
  diskFull: {
    label: 'disk full',
    title: 'Paused: the phone is full',
    icon: 'disk',
    detail: 'The phone ran out of space.',
    isFault: true,
  },
  mediaServicesReset: {
    label: 'media reset',
    title: 'Paused: iOS reset its media',
    icon: 'rotate',
    detail: 'iOS restarted its media services.',
    isFault: true,
  },
};

export function participantNames({ participants }: CallStatus): string[] {
  return participants.map((participant) => participant.identity);
}

export function describeCall(
  call: CallStatus,
  inSession: boolean,
): { text: string; tone: TextTone } {
  switch (call.state) {
    case 'connected': {
      const names = participantNames(call);
      const others = names.length > 0 ? `with ${names.join(', ')}` : 'waiting for the interviewer';
      return {
        text: `Call: connected · ${call.quality} · ${call.profile} · ${others}`,
        tone: 'secondary',
      };
    }
    case 'connecting':
      return { text: 'Call: connecting…', tone: 'secondary' };
    case 'reconnecting':
      return { text: 'Call: reconnecting…', tone: 'warning' };
    case 'disconnected':
      return inSession
        ? { text: 'Call: lost, the recording goes on', tone: 'warning' }
        : { text: 'Call: not connected', tone: 'muted' };
  }
}

export const METER_BARS = 5;
const METER_FLOOR_DB = -60;

export function litBars(levelDb: number): number {
  const ratio = Math.min(1, Math.max(0, (levelDb - METER_FLOOR_DB) / -METER_FLOOR_DB));
  return Math.ceil(ratio * METER_BARS);
}
