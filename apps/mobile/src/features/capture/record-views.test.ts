import { describe, expect, it } from '@jest/globals';

import type { CaptureConfig, HealthSnapshot, SessionSnapshot } from '@modules/capture-core';

import { inRoom, participant } from '@test/call-fixtures';
import { snapshot } from '@test/session-fixtures';

import {
  callRowView,
  headerFact,
  micChip,
  pausedView,
  previewCaption,
  recChipText,
  recStripView,
} from './record-views';

const GB = 1_024 ** 3;
const MB = 1_024 ** 2;
const recording: CaptureConfig['recording'] = {
  codec: 'hevc',
  videoBitrate: 6_000_000,
  keyFrameIntervalSec: 1,
  audioBitrate: 128_000,
  fragmentIntervalSec: 1,
  initialFragmentIntervalSec: 1,
};
const profiles = {
  standard: { width: 1280, height: 720, fps: 30 },
  reduced: { width: 960, height: 540, fps: 24 },
  minimal: { width: 640, height: 360, fps: 15 },
};
const inSession = (overrides: Partial<SessionSnapshot> = {}) =>
  snapshot({
    phase: 'recording',
    sessionId: 's1',
    segmentIndex: 2,
    recordedSec: 312,
    ...overrides,
  });
const health = (bytes: number, diskFreeBytes: number) =>
  ({ file: { bytes }, diskFreeBytes }) as HealthSnapshot;

describe('headerFact', () => {
  // 6.128 Mbit/s fills 2.76 GB an hour.
  it('gives free space and hours left when ready', () =>
    expect(headerFact(snapshot(), health(0, 41.2 * GB), recording)).toBe(
      '41.2 GB free · about 16 h',
    ));
  it('gives the segment and its size while recording', () =>
    expect(headerFact(inSession(), health(238 * MB, 0), recording)).toBe('seg 2 · 238.0 MB'));
  it('says the segment is saved when paused', () =>
    expect(headerFact(inSession({ phase: 'paused' }), null, recording)).toBe('seg 2 saved'));
});

describe('callRowView', () => {
  const view = (overrides: Partial<SessionSnapshot>) =>
    callRowView(inSession(overrides), profiles, 'mydirector-poc');

  it('says when the phone joins', () =>
    expect(callRowView(snapshot(), profiles, 'mydirector-poc')).toEqual({
      title: 'Room mydirector-poc',
      detail: 'You join the call when recording starts',
      inCall: false,
      chip: { label: 'not joined', tone: 'neutral' },
    }));

  it('names the interviewer and what the phone sends', () =>
    expect(view({ call: inRoom() })).toEqual({
      title: 'interviewer',
      detail: 'mydirector-poc · you send 720p 30 fps',
      inCall: true,
      chip: { label: 'excellent', tone: 'success', lit: 3 },
    }));

  it('counts the others', () =>
    expect(
      view({ call: inRoom([participant('interviewer'), participant('producer')]) }).title,
    ).toBe('interviewer +1'));

  it('waits for the interviewer', () =>
    expect(view({ call: inRoom([]) })).toMatchObject({
      detail: 'Nobody else here yet',
      chip: { label: 'waiting', tone: 'paused' },
    }));

  it('says the phone is muted while paused', () =>
    expect(view({ phase: 'paused', call: { ...inRoom(), isMuted: true } })).toMatchObject({
      detail: 'Still in the room · your camera and mic are muted',
      inCall: false,
      chip: { label: 'muted', tone: 'paused' },
    }));
});

describe('previewCaption', () => {
  it('names the camera and its format', () =>
    expect(
      previewCaption({
        position: 'front',
        width: 1920,
        height: 1080,
        fps: 30,
        stabilization: 'off',
      }),
    ).toBe('Front camera · 1920×1080 · 30 fps'));
});

describe('pausedView', () => {
  it('explains a phone call', () =>
    expect(pausedView('phoneCall', 2)).toEqual({
      icon: 'phone',
      title: 'Paused for a phone call',
      text: 'iOS took the microphone for the call. Segment 2 is closed and safe on disk. Resume starts segment 3 in the same room.',
    }));
});

describe('recStripView', () => {
  it('shows the recording time and segment', () =>
    expect(recStripView(inSession())).toEqual({
      tone: 'recording',
      label: 'REC',
      time: '05:12',
      detail: '· seg 2',
    }));
  it('turns amber when paused', () =>
    expect(recStripView(inSession({ phase: 'paused' }))).toEqual({
      tone: 'paused',
      label: 'PAUSED',
      time: '05:12',
      detail: '· seg 2 saved',
    }));
});

describe('preview chips', () => {
  it('shows the file frame rate', () =>
    expect(recChipText({ file: { fps: 29.97 } } as HealthSnapshot)).toBe('REC 30 fps'));
  it('lights the mic bars and rounds the level', () =>
    expect(micChip({ audio: { levelDb: -23.4 } } as HealthSnapshot)).toEqual({
      lit: 4,
      level: '-23 dB',
    }));
});
