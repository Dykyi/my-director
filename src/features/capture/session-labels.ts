import type { CallStatus, PauseReason, SessionPhase } from '@modules/capture-core';

import type { IconName } from '@ui/icons';
import type { PillTone } from '@ui/status-pill';

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

export const PAUSE_REASON: Record<PauseReason, { title: string; icon: IconName; detail: string }> =
  {
    user: {
      title: 'Paused by you',
      icon: 'pause-circle',
      detail: 'You paused the recording.',
    },
    phoneCall: {
      title: 'Paused for a phone call',
      icon: 'phone',
      detail: 'iOS took the microphone for the call.',
    },
    audioInterrupted: {
      title: 'Paused: another app took the audio',
      icon: 'volume-off',
      detail: 'Another app took the audio.',
    },
    appBackground: {
      title: 'Paused in the background',
      icon: 'home',
      detail: 'The app went to the background, where iOS stops the camera.',
    },
    screenLocked: {
      title: 'Paused: the screen locked',
      icon: 'lock',
      detail: 'The screen locked, and iOS stopped the camera.',
    },
    cameraInterrupted: {
      title: 'Paused: the camera was taken',
      icon: 'video-off',
      detail: 'iOS gave the camera to something else.',
    },
    cameraError: {
      title: 'Paused: camera error',
      icon: 'warning',
      detail: 'The camera reported an error.',
    },
    cameraStalled: {
      title: 'Paused: the camera stopped',
      icon: 'video-off',
      detail: 'The camera stopped delivering frames.',
    },
    micStalled: {
      title: 'Paused: the microphone stopped',
      icon: 'mic-off',
      detail: 'The microphone stopped delivering audio.',
    },
    fileError: {
      title: 'Paused: the file failed',
      icon: 'disk',
      detail: 'Writing the file failed.',
    },
    diskFull: {
      title: 'Paused: the phone is full',
      icon: 'disk',
      detail: 'The phone ran out of space.',
    },
    mediaServicesReset: {
      title: 'Paused: iOS reset its media',
      icon: 'rotate',
      detail: 'iOS restarted its media services.',
    },
  };

export function participantNames({ participants }: CallStatus): string[] {
  return participants.map((participant) => participant.identity);
}

export const METER_BARS = 5;
const METER_FLOOR_DB = -60;

export function litBars(levelDb: number): number {
  const ratio = Math.min(1, Math.max(0, (levelDb - METER_FLOOR_DB) / -METER_FLOOR_DB));
  return Math.ceil(ratio * METER_BARS);
}
