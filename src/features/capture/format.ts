import type { RecoveryReport } from '@modules/capture-core';

const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;
const BYTES_PER_UNIT = 1_024;

export function formatDuration(totalSec: number): string {
  const total = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = String(total % SECONDS_PER_MINUTE).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= BYTES_PER_UNIT && unit < BYTE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unit += 1;
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

export function formatLoss({ knownLossSec, maxUnseenLossSec }: RecoveryReport): string {
  if (knownLossSec === 0 && maxUnseenLossSec === 0) return 'nothing lost';
  const unseen = maxUnseenLossSec > 0 ? ` (+ up to ${maxUnseenLossSec} s unseen)` : '';
  return `lost ≈ ${knownLossSec.toFixed(1)} s${unseen}`;
}
