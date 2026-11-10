import { describe, expect, it } from '@jest/globals';

import type { RecoveryReport } from '@modules/capture-core';

import {
  formatBytes,
  formatClock,
  formatDuration,
  formatLogLine,
  formatLoss,
  formatResolution,
  formatSessionTime,
  formatTimer,
  profileLabel,
} from './format';

describe('formatDuration', () => {
  it('shows minutes and seconds', () => expect(formatDuration(65.9)).toBe('1:05'));
  it('shows hours when needed', () => expect(formatDuration(3_725)).toBe('1:02:05'));
  it('never goes negative', () => expect(formatDuration(-3)).toBe('0:00'));
});

describe('formatBytes', () => {
  it('shows bytes', () => expect(formatBytes(512)).toBe('512 B'));
  it('shows megabytes with one decimal', () => expect(formatBytes(482_344_960)).toBe('460.0 MB'));
  it('shows gigabytes', () => expect(formatBytes(44_237_824_000)).toBe('41.2 GB'));
});

describe('formatLoss', () => {
  const report = (knownLossSec: number, maxUnseenLossSec: number) =>
    ({ knownLossSec, maxUnseenLossSec }) as RecoveryReport;

  it('shows the known loss', () => expect(formatLoss(report(1.43, 0))).toBe('≈ 1.4 s'));
  it('adds what the manifest could not see as a range', () =>
    expect(formatLoss(report(1.43, 1))).toBe('1.4 to 2.4 s'));
  it('shows an unseen loss alone', () => expect(formatLoss(report(0, 1))).toBe('up to 1.0 s'));
  it('shows a clean recovery', () => expect(formatLoss(report(0, 0))).toBe('none'));
});

describe('formatSessionTime', () => {
  const now = new Date(2026, 10, 10, 9, 30);
  const at = (day: number, hours: number, minutes: number) =>
    new Date(2026, 10, day, hours, minutes).toISOString();

  it('says today', () => expect(formatSessionTime(at(10, 9, 5), now)).toBe('Today 09:05'));
  it('says yesterday', () => expect(formatSessionTime(at(9, 22, 13), now)).toBe('Yesterday 22:13'));
  it('names older days', () => expect(formatSessionTime(at(8, 21, 4), now)).toBe('Nov 8 21:04'));
});

describe('formatLogLine', () => {
  it('shows the time, level, category, message and data', () =>
    expect(
      formatLogLine({
        at: '2026-11-10T09:12:33.456Z',
        mono: 1,
        level: 'warning',
        category: 'audio',
        message: 'Microphone restarted',
        data: { gapMs: '1102' },
      }),
    ).toBe('09:12:33.456 warning audio Microphone restarted gapMs=1102'));

  it('leaves out empty data', () =>
    expect(
      formatLogLine({
        at: '2026-11-10T09:12:33.456Z',
        mono: 1,
        level: 'info',
        category: 'call',
        message: 'Connected',
      }),
    ).toBe('09:12:33.456 info call Connected'));
});

describe('formatClock', () => {
  it('shows local wall-clock time', () =>
    expect(formatClock(new Date(2026, 10, 10, 9, 7, 5).toISOString())).toBe('09:07:05'));
});

describe('formatTimer', () => {
  it('pads minutes like the header timer', () => expect(formatTimer(312)).toBe('05:12'));
  it('shows hours when needed', () => expect(formatTimer(3_725)).toBe('1:02:05'));
  it('starts at zero', () => expect(formatTimer(0)).toBe('00:00'));
});

describe('formatResolution', () => {
  it('joins width and height with a times sign', () =>
    expect(formatResolution(1920, 1080)).toBe('1920×1080'));
});

describe('profileLabel', () => {
  it('names a call profile by its height and frame rate', () =>
    expect(profileLabel({ height: 720, fps: 30 })).toBe('720p 30 fps'));
});
