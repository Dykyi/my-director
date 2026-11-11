import type { PhoneStats } from './stats-collector.ts';

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

interface Quality {
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

export const orDash = (value: number | undefined): string =>
  value === undefined ? '-' : String(value);

export function statsLine(stats: PhoneStats): string {
  const { frameWidth, frameHeight, framesPerSecond, freezeCount, bitrate } = stats;
  const mbps = bitrate === undefined ? '-' : (bitrate / BITS_PER_MEGABIT).toFixed(1);
  return `${orDash(frameWidth)}×${orDash(frameHeight)} · ${orDash(framesPerSecond)} fps · ${orDash(freezeCount)} freezes · ${mbps} Mbps`;
}

export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const seconds = String(sec % SECONDS_PER_MINUTE).padStart(2, '0');
  return `${Math.floor(sec / SECONDS_PER_MINUTE)}:${seconds}`;
}

const MINUTES_CLOCK_LENGTH = 'mm:ss'.length;

export const formatMinutes = (totalSec: number): string =>
  formatClock(totalSec).padStart(MINUTES_CLOCK_LENGTH, '0');

const MS_PER_TENTH = 100;
const twoDigits = (value: number) => String(value).padStart(2, '0');

/** Local time with tenths, so a filmed frame shows the clock moving. */
export function formatTimeOfDay(ms: number): string {
  const time = new Date(ms);
  const tenths = Math.floor(time.getMilliseconds() / MS_PER_TENTH);
  return `${twoDigits(time.getHours())}:${twoDigits(time.getMinutes())}:${twoDigits(time.getSeconds())}.${tenths}`;
}

export const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const LOGGED_WORDS = 6;

export function firstWords(text: string): string {
  const words = text.split(' ');
  return words.length > LOGGED_WORDS ? `${words.slice(0, LOGGED_WORDS).join(' ')}…` : text;
}
