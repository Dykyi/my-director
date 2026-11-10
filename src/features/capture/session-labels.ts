import type { CallStatus, PauseReason, SessionPhase } from '@modules/capture-core';

export type Tone = 'normal' | 'secondary' | 'muted' | 'accent' | 'warning' | 'error';
export type PillTone = 'neutral' | 'recording' | 'paused';

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

export const PAUSE_REASON: Record<PauseReason, { label: string; detail: string; isFault: boolean }> = {
  user: { label: 'by you', detail: 'You paused the recording.', isFault: false },
  phoneCall: { label: 'phone call', detail: 'iOS took the microphone for a call.', isFault: false },
  audioInterrupted: { label: 'audio taken', detail: 'Another app took the audio.', isFault: false },
  appBackground: { label: 'in background', detail: 'The app went to the background, where iOS stops the camera.', isFault: false },
  screenLocked: { label: 'screen locked', detail: 'The screen locked, and iOS stopped the camera.', isFault: false },
  cameraInterrupted: { label: 'camera taken', detail: 'iOS gave the camera to something else.', isFault: false },
  cameraError: { label: 'camera error', detail: 'The camera reported an error.', isFault: true },
  cameraStalled: { label: 'camera stopped', detail: 'The camera stopped delivering frames.', isFault: true },
  micStalled: { label: 'mic stopped', detail: 'The microphone stopped delivering audio.', isFault: true },
  fileError: { label: 'file error', detail: 'Writing the file failed.', isFault: true },
  diskFull: { label: 'disk full', detail: 'The phone ran out of space.', isFault: true },
  mediaServicesReset: { label: 'media reset', detail: 'iOS restarted its media services.', isFault: true },
};

export function describeCall(call: CallStatus, inSession: boolean): { text: string; tone: Tone } {
  switch (call.state) {
    case 'connected': {
      const others = call.remoteParticipants.length > 0 ? `with ${call.remoteParticipants.join(', ')}` : 'waiting for the interviewer';
      return { text: `Call: connected · ${call.quality} · ${call.profile} · ${others}`, tone: 'secondary' };
    }
    case 'connecting':
      return { text: 'Call: connecting…', tone: 'secondary' };
    case 'reconnecting':
      return { text: 'Call: reconnecting…', tone: 'warning' };
    case 'disconnected':
      return inSession ? { text: 'Call: lost, the recording goes on', tone: 'warning' } : { text: 'Call: not connected', tone: 'muted' };
  }
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
