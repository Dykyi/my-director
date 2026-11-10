import type { LogEntry, RecoveryReport } from '@modules/capture-core';

const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;
const BYTES_PER_UNIT = 1_024;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const LOG_TIME_START = 11;
const LOG_TIME_END = 23;

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
  if (maxUnseenLossSec === 0) return knownLossSec === 0 ? 'none' : `≈ ${knownLossSec.toFixed(1)} s`;
  if (knownLossSec === 0) return `up to ${maxUnseenLossSec.toFixed(1)} s`;
  return `${knownLossSec.toFixed(1)} to ${(knownLossSec + maxUnseenLossSec).toFixed(1)} s`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatSessionTime(createdAt: string, now = new Date()): string {
  const date = new Date(createdAt);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(date, now)) return `Today ${time}`;
  if (sameDay(date, yesterday)) return `Yesterday ${time}`;
  return `${MONTHS[date.getMonth()]} ${date.getDate()} ${time}`;
}

export function formatLogLine({ at, level, category, message, data }: LogEntry): string {
  const details = data ? Object.entries(data).map(([key, value]) => ` ${key}=${value}`).join('') : '';
  return `${at.slice(LOG_TIME_START, LOG_TIME_END)} ${level} ${category} ${message}${details}`;
}
