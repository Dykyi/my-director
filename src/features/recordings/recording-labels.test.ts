import { describe, expect, it } from '@jest/globals';

import type { RecordingSummary, SegmentSummary } from '@modules/capture-core';

import type { UploadStatus } from '@features/upload/use-uploads';

import {
  cardActions,
  deleteMessage,
  lossNote,
  recordingChip,
  recordingMeta,
  recoveredNote,
  segmentLine,
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
