import type {
  CallStatus,
  HealthSnapshot,
  SessionPhase,
  SessionSnapshot,
} from '@modules/capture-core';

import { formatBytes } from './format';
import { participantNames, type Tone } from './session-labels';

export type HealthRow = { label: string; value: string; tone: Tone; meterBars?: number };

export const METER_BARS = 5;
const METER_FLOOR_DB = -60;
const MIC_SILENT_AFTER_MS = 1_000;
const KBPS_PER_MBPS = 1_000;
const MS_PER_SEC = 1_000;
const BLUETOOTH_PORT = 'Bluetooth';
const HOT: ReadonlySet<HealthSnapshot['thermal']> = new Set(['serious', 'critical']);
const RECORDING_PHASES: ReadonlySet<SessionPhase> = new Set(['recording', 'resuming']);

function signed(value: number): string {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function meterBars(levelDb: number): number {
  const ratio = Math.min(1, Math.max(0, (levelDb - METER_FLOOR_DB) / -METER_FLOOR_DB));
  return Math.ceil(ratio * METER_BARS);
}

function audioRow({ audio }: HealthSnapshot, phase: SessionPhase): HealthRow {
  const silent = audio.lastBufferAgeMs < 0 || audio.lastBufferAgeMs > MIC_SILENT_AFTER_MS;
  if (silent && RECORDING_PHASES.has(phase) && audio.lastBufferAgeMs >= 0) {
    return {
      label: 'Audio',
      value: `no audio for ${(audio.lastBufferAgeMs / MS_PER_SEC).toFixed(1)} s`,
      tone: 'error',
    };
  }
  if (silent) return { label: 'Audio', value: 'mic off', tone: 'muted' };
  return {
    label: 'Audio',
    value: `${audio.levelDb.toFixed(0)} dB  drift ${signed(audio.driftMs)} ms${audio.resyncCount > 0 ? `  resync ${audio.resyncCount}` : ''}`,
    tone: 'normal',
    meterBars: meterBars(audio.levelDb),
  };
}

function fileRow({ file }: HealthSnapshot): HealthRow {
  const size = formatBytes(file.bytes);
  switch (file.writer) {
    case 'writing':
      return {
        label: 'File',
        value: `${file.fps.toFixed(1)} fps  ${size}  drops ${file.droppedFrames}`,
        tone: 'normal',
      };
    case 'finishing':
      return { label: 'File', value: `finishing · ${size}`, tone: 'secondary' };
    case 'failed':
      return { label: 'File', value: `failed · ${size}`, tone: 'error' };
    case 'idle':
      return { label: 'File', value: 'idle', tone: 'muted' };
  }
}

function callRow({ call }: HealthSnapshot): HealthRow {
  if (call.sentWidth === 0) return { label: 'Call', value: 'not sending', tone: 'muted' };
  const sent = `${call.sentWidth}×${call.sentHeight} ${call.sentFps.toFixed(0)} fps ${(call.bitrateKbps / KBPS_PER_MBPS).toFixed(1)} Mbps`;
  return call.qualityLimitation === 'none'
    ? { label: 'Call', value: sent, tone: 'normal' }
    : { label: 'Call', value: `${sent} · limited by ${call.qualityLimitation}`, tone: 'warning' };
}

function roomRow(call: CallStatus): HealthRow {
  if (call.state === 'disconnected' || call.room === undefined)
    return { label: 'Room', value: 'not joined', tone: 'muted' };
  const names = participantNames(call);
  return names.length > 0
    ? { label: 'Room', value: `${call.room} · ${names.join(', ')}`, tone: 'normal' }
    : { label: 'Room', value: `${call.room} · nobody else yet`, tone: 'warning' };
}

const routeTone = (port: string): Tone => (port.includes(BLUETOOTH_PORT) ? 'accent' : 'normal');

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
          value: `${camera.fps.toFixed(1)} fps ${camera.width}×${camera.height}`,
          tone: 'normal',
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
      tone: HOT.has(health.thermal) ? 'warning' : 'normal',
    },
    { label: 'Disk', value: `${formatBytes(health.diskFreeBytes)} free`, tone: 'normal' },
  ];
}
