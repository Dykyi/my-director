import { describe, expect, it } from '@jest/globals';

import type { RecoveryReport } from '@modules/capture-core';

import { formatBytes, formatDuration, formatLoss } from './format';

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

  it('shows known and unseen loss', () => expect(formatLoss(report(1.43, 1))).toBe('lost ≈ 1.4 s (+ up to 1 s unseen)'));
  it('shows a clean recovery', () => expect(formatLoss(report(0, 0))).toBe('nothing lost'));
});
