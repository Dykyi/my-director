const PAUSED = 'The phone paused';
const PAUSE_TITLE: Record<string, string> = {
  user: 'The phone paused: Pause was pressed on it',
  phoneCall: 'The phone paused for a phone call',
  audioInterrupted: 'The phone paused: another app took the audio',
  appBackground: 'The phone paused: the app went to the background',
  screenLocked: 'The phone paused: the screen locked',
  cameraInterrupted: 'The phone paused: iOS took the camera',
  cameraError: 'The phone paused: camera error',
  cameraStalled: 'The phone paused: the camera stopped',
  micStalled: 'The phone paused: the microphone stopped',
  fileError: 'The phone paused: the file failed',
  diskFull: 'The phone paused: the phone is full',
  mediaServicesReset: 'The phone paused: iOS reset its media',
};

export const pauseTitle = (reason: string): string => PAUSE_TITLE[reason] ?? PAUSED;

export interface Quality {
  bars: number;
  label: string;
}

/** By LiveKit's `ConnectionQuality` values; anything else is still being measured. */
const QUALITY: Record<string, Quality> = {
  excellent: { bars: 3, label: 'excellent' },
  good: { bars: 2, label: 'good' },
  poor: { bars: 1, label: 'poor' },
  lost: { bars: 0, label: 'lost' },
};
const MEASURING: Quality = { bars: 0, label: 'measuring' };

export const qualityOf = (quality: string): Quality => QUALITY[quality] ?? MEASURING;

const BITS_PER_MEGABIT = 1_000_000;
const SECONDS_PER_MINUTE = 60;
const FLOOR_DB = -90;

export const orDash = (value: number | undefined): string =>
  value === undefined ? '-' : String(value);

export interface StatsLineValues {
  width?: number;
  height?: number;
  fps?: number;
  freezes?: number;
  bitrate?: number;
}

export function statsLine({ width, height, fps, freezes, bitrate }: StatsLineValues): string {
  const mbps = bitrate === undefined ? '-' : (bitrate / BITS_PER_MEGABIT).toFixed(1);
  return `${orDash(width)}×${orDash(height)} · ${orDash(fps)} fps · ${orDash(freezes)} freezes · ${mbps} Mbps`;
}

export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const seconds = String(sec % SECONDS_PER_MINUTE).padStart(2, '0');
  return `${Math.floor(sec / SECONDS_PER_MINUTE)}:${seconds}`;
}

export const levelDb = (level: number): number =>
  level > 0 ? Math.max(FLOOR_DB, Math.round(20 * Math.log10(level))) : FLOOR_DB;
