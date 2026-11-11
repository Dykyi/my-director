import { describe, expect, it } from '@jest/globals';

import type {
  RecordingSummary,
  RecoveryReport,
  SegmentSummary,
  VerificationCheck,
} from '@modules/capture-core';

import type { UploadStatus } from '@features/upload/upload-plan';
import { sampleHealth } from '@test/session-fixtures';

import {
  cardActions,
  deleteMessage,
  isCompleteSegment,
  lossNote,
  recordingChip,
  recordingMeta,
  recordingsFact,
  recoveredNote,
  recoveryView,
  segmentLine,
  verificationVerdict,
} from './recording-labels';

const MB = 1_024 ** 2;
const segment = (index: number, overrides: Partial<SegmentSummary> = {}): SegmentSummary => ({
  index,
  uri: `file:///Documents/Recordings/s1/segment-00${index}.mov`,
  state: 'finalized',
  durationSec: 238,
  bytes: 183 * MB,
  ...overrides,
});
const recording = (overrides: Partial<RecordingSummary> = {}): RecordingSummary => ({
  sessionId: 's1',
  createdAt: '2026-11-10T09:12:00.000Z',
  state: 'finished',
  segments: [segment(1), segment(2)],
  totalSec: 550,
  totalBytes: 422 * MB,
  ...overrides,
});
const status = (overrides: Partial<UploadStatus> = {}): UploadStatus => ({
  pending: [],
  uploading: false,
  verified: false,
  ...overrides,
});

describe('recordingChip', () => {
  it('says the upload is running', () =>
    expect(recordingChip(recording(), status({ uploading: true }))).toEqual({
      label: 'uploading',
      tone: 'accent',
    }));
  it('says everything is on the server', () =>
    expect(recordingChip(recording(), status({ verified: true }))).toEqual({
      label: 'uploaded',
      tone: 'success',
    }));
  it('falls back to the recording state', () => {
    expect(recordingChip(recording(), status({ pending: [segment(1)] }))).toEqual({
      label: 'finished',
      tone: 'success',
    });
    expect(recordingChip(recording({ state: 'recovered' }), status())).toEqual({
      label: 'recovered',
      tone: 'paused',
    });
  });
});

describe('card text', () => {
  it('sums the recording up', () =>
    expect(recordingMeta(recording())).toBe('9:10 · 2 seg · 422.0 MB'));
  it('names a segment by its file', () =>
    expect(segmentLine(segment(1))).toBe('segment-001.mov 3:58 183.0 MB'));
  it('tells how much of a recovered session plays', () =>
    expect(
      recoveredNote(recording({ segments: [segment(1), segment(2, { state: 'unplayable' })] })),
    ).toBe('Recovered after the app was closed. Playable segments: 1 of 2.'));
});

describe('cardActions', () => {
  it('offers the upload while segments wait, and still the delete', () =>
    expect(cardActions(status({ pending: [segment(1)] }), false)).toEqual([
      'play',
      'verify',
      'upload',
      'delete',
    ]));
  it('offers to cancel a running upload', () =>
    expect(cardActions(status({ uploading: true }), false)).toEqual(['play', 'verify', 'cancel']));
  it('offers to delete what is uploaded', () =>
    expect(cardActions(status({ verified: true }), false)).toEqual(['play', 'verify', 'delete']));
  it('never deletes the session being recorded', () =>
    expect(cardActions(status({ pending: [segment(1)] }), true)).toEqual([
      'play',
      'verify',
      'upload',
    ]));
});

describe('deleteMessage', () => {
  it('says what leaves the phone', () =>
    expect(deleteMessage(recording(), 0)).toBe(
      '2 segments, 422.0 MB will be removed from the phone.',
    ));
  it('counts the segments already in the bucket', () =>
    expect(deleteMessage(recording(), 1)).toBe(
      '2 segments, 422.0 MB will be removed from the phone. Uploaded to the bucket: 1 segment.',
    ));
});

describe('lossNote', () => {
  it('says how often the file and the session note reach the disk', () =>
    expect(
      lossNote({ recording: { fragmentIntervalSec: 2 }, session: { heartbeatIntervalSec: 1 } }),
    ).toBe(
      'Video reaches the disk every 2 s and the progress note every 1 s, so a crash loses only the tail after the last save.',
    ));
});

describe('isCompleteSegment', () => {
  it('counts finalized and recovered files, not writing or unplayable ones', () => {
    const states = ['finalized', 'recovered', 'writing', 'unplayable'] as const;
    expect(states.filter((state) => isCompleteSegment(segment(1, { state })))).toEqual([
      'finalized',
      'recovered',
    ]);
  });
});

describe('recordingsFact', () => {
  it('counts the sessions and adds the free space once health arrives', () => {
    expect(recordingsFact(0, null)).toBe('0 sessions');
    expect(recordingsFact(2, sampleHealth())).toBe('2 sessions · 41.0 GB free');
  });
});

describe('recoveryView', () => {
  const report = (segments: SegmentSummary[]): RecoveryReport => ({
    sessionId: 's1',
    createdAt: '2026-11-10T09:12:00.000Z',
    segments,
    recoveredSec: 362,
    knownLossSec: 0.4,
    maxUnseenLossSec: 1,
  });

  it('plays from the last segment that opens and counts the ones that do not', () => {
    const view = recoveryView(report([segment(1), segment(2, { state: 'unplayable' })]));
    expect(view.lastPlayable).toBe(1);
    expect(view.summary).toBe('The app was closed while recording. What was on disk is playable.');
    expect(view.unplayableNote).toBe('1 segment could not be opened.');
  });

  it('says so when nothing on disk opens', () => {
    const view = recoveryView(report([segment(1, { state: 'unplayable' })]));
    expect(view.lastPlayable).toBeUndefined();
    expect(view.summary).toBe(
      'The app was closed while recording. Nothing on disk could be opened.',
    );
    expect(view.unplayableNote).toBeUndefined();
  });
});

describe('verificationVerdict', () => {
  const check = (overrides: Partial<VerificationCheck> = {}): VerificationCheck => ({
    id: 'gaps',
    label: 'Frame gaps',
    expected: '≤ 0.50 %, longest ≤ 100 ms',
    actual: '0.02 %, longest 133 ms',
    pass: true,
    ...overrides,
  });

  it('passes clean checks', () =>
    expect(verificationVerdict(true, [check()])).toEqual({ label: 'PASS', tone: 'success' }));
  it('passes a recovered segment cut by the crash in amber', () =>
    expect(verificationVerdict(true, [check({ crashTail: true })])).toEqual({
      label: 'PASS · recovered',
      tone: 'paused',
    }));
  it('fails in red even with a crash tail', () =>
    expect(
      verificationVerdict(false, [check({ crashTail: true }), check({ id: 'fps', pass: false })]),
    ).toEqual({ label: 'FAIL', tone: 'danger' }));
});
