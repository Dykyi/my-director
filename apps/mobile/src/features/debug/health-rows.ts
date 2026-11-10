import type {
  CallStatus,
  HealthSnapshot,
  SessionPhase,
  SessionSnapshot,
} from '@modules/capture-core';

import { participantNames, sendingText } from '@features/capture/call-labels';
import { litBars } from '@features/capture/mic-level';
import { formatBytes, formatResolution } from '@shared/format';
import { MS_PER_SEC } from '@shared/units';
import type { TextTone } from '@ui/tone';

type HealthRow = { label: string; value: string; tone: TextTone; meterBars?: number };

const MIC_SILENT_AFTER_MS = 1_000;
const BLUETOOTH_PORT = 'Bluetooth';
const HOT: ReadonlySet<HealthSnapshot['thermal']> = new Set(['serious', 'critical']);
const RECORDING_PHASES: ReadonlySet<SessionPhase> = new Set(['recording', 'resuming']);

function formatSigned(value: number): string {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function audioRow({ audio }: HealthSnapshot, phase: SessionPhase): HealthRow {
  const silent = audio.lastBufferAgeMs < 0 || audio.lastBufferAgeMs > MIC_SILENT_AFTER_MS;
  if (silent && RECORDING_PHASES.has(phase) && audio.lastBufferAgeMs >= 0) {
    return {
      label: 'Audio',
      value: `no audio for ${(audio.lastBufferAgeMs / MS_PER_SEC).toFixed(1)} s`,
      tone: 'danger',
    };
  }
  if (silent) return { label: 'Audio', value: 'mic off', tone: 'muted' };
  return {
    label: 'Audio',
    value: `${audio.levelDb.toFixed(0)} dB  drift ${formatSigned(audio.driftMs)} ms${audio.resyncCount > 0 ? `  resync ${audio.resyncCount}` : ''}`,
    tone: 'foreground',
    meterBars: litBars(audio.levelDb),
  };
}

function fileRow({ file }: HealthSnapshot): HealthRow {
  const size = formatBytes(file.bytes);
  switch (file.writer) {
    case 'writing':
      return {
        label: 'File',
        value: `${file.fps.toFixed(1)} fps  ${size}  drops ${file.droppedFrames}`,
        tone: 'foreground',
      };
    case 'finishing':
      return { label: 'File', value: `finishing · ${size}`, tone: 'subtle' };
    case 'failed':
      return { label: 'File', value: `failed · ${size}`, tone: 'danger' };
    case 'idle':
      return { label: 'File', value: 'idle', tone: 'muted' };
  }
}

function callRow({ call }: HealthSnapshot): HealthRow {
  const sent = sendingText(call);
  if (sent === undefined) return { label: 'Call', value: 'not sending', tone: 'muted' };
  return call.qualityLimitation === 'none'
    ? { label: 'Call', value: sent, tone: 'foreground' }
    : { label: 'Call', value: `${sent} · limited by ${call.qualityLimitation}`, tone: 'warning' };
}

function roomRow(call: CallStatus): HealthRow {
  if (call.state === 'disconnected' || call.room === undefined)
    return { label: 'Room', value: 'not joined', tone: 'muted' };
  const names = participantNames(call);
  return names.length > 0
    ? { label: 'Room', value: `${call.room} · ${names.join(', ')}`, tone: 'foreground' }
    : { label: 'Room', value: `${call.room} · nobody else yet`, tone: 'warning' };
}

const routeTone = (port: string): TextTone =>
  port.includes(BLUETOOTH_PORT) ? 'accent' : 'foreground';

export function healthRows(
  health: HealthSnapshot,
  { phase, call }: Pick<SessionSnapshot, 'phase' | 'call'>,
): HealthRow[] {
  const { camera, audioRoute } = health;
  return [
    camera.width === 0
      ? { label: 'Camera', value: 'off', tone: 'muted' }
      : {
          label: 'Camera',
          value: `${camera.fps.toFixed(1)} fps ${formatResolution(camera.width, camera.height)}`,
          tone: 'foreground',
        },
    fileRow(health),
    audioRow(health, phase),
    { label: 'Input', value: audioRoute.input, tone: routeTone(audioRoute.input) },
    { label: 'Output', value: audioRoute.output, tone: routeTone(audioRoute.output) },
    callRow(health),
    roomRow(call),
    {
      label: 'Thermal',
      value: `${health.thermal} · pressure ${health.systemPressure}`,
      tone: HOT.has(health.thermal) ? 'warning' : 'foreground',
    },
    { label: 'Disk', value: `${formatBytes(health.diskFreeBytes)} free`, tone: 'foreground' },
  ];
}
