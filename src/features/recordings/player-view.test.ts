import { describe, expect, it } from '@jest/globals';

import type { RecoveryReport } from '@modules/capture-core';

import { interview } from '@test/player-fixtures';
import { recording, segment } from '@test/session-fixtures';

import { playerView, startingSegment, type Playback } from './player-view';

const at = (current: number, elapsedSec = 0, playback: Playback = 'playing') => ({
  current,
  elapsedSec,
  playback,
});

describe('playerView', () => {
  it('names the segment that plays and its file', () => {
    const view = playerView(interview, at(1, 72));
    expect(view.title).toBe('Segment 1 of 3');
    expect(view.file).toBe('segment-001.mov · 3:58');
    expect(view.origin).toBe('Start of the recording');
  });

  it('says what came before a later segment', () => {
    expect(playerView(interview, at(2, 0)).origin).toBe('Starts after a phone call');
    expect(playerView(interview, at(3, 0)).origin).toBe('Starts after the screen locked');
  });

  it('places the segment in the whole recording', () => {
    const view = playerView(interview, at(2, 20));
    expect(view.whole).toBe('4:18 of 9:10');
    expect(view.progress).toBeCloseTo(20 / 160);
  });

  it('steps over segments that cannot be opened', () => {
    const broken = recording({
      segments: [segment(1), segment(2, { state: 'unplayable' }), segment(3)],
    });
    expect(playerView(broken, at(1, 0))).toMatchObject({ previous: undefined, next: 3 });
    expect(playerView(broken, at(3, 0))).toMatchObject({ previous: 1, next: undefined });
  });

  it('shows the pause between segments, not after the last one', () => {
    const paused = recording({
      segments: [segment(1, { pauseReason: 'user' }), segment(2, { pauseReason: 'user' })],
    });
    expect(playerView(paused, at(1, 0)).items.map((item) => item.pauseAfter)).toEqual([
      'user',
      undefined,
    ]);
  });

  it('marks each segment by what it is', () => {
    const mixed = recording({
      segments: [
        segment(1),
        segment(2, { state: 'recovered' }),
        segment(3, { state: 'unplayable' }),
        segment(4, { state: 'writing' }),
      ],
    });
    expect(playerView(mixed, at(1, 0)).items.map((item) => item.chip)).toEqual([
      { label: 'playing', tone: 'accent' },
      { label: 'recovered', tone: 'paused' },
      { label: 'could not be opened', tone: 'danger' },
      { label: 'recording', tone: 'recording' },
    ]);
    expect(playerView(mixed, at(2, 0)).items[1]?.chip).toEqual({
      label: 'recovered · playing',
      tone: 'paused',
    });
    expect(playerView(mixed, at(2, 0)).items[0]?.chip).toBeUndefined();
  });

  it('says when the segment is paused or the recording has ended', () => {
    expect(playerView(interview, at(1, 30, 'paused')).items[0]?.chip).toEqual({
      label: 'paused',
      tone: 'neutral',
    });
    expect(playerView(interview, at(3, 152, 'ended')).items[2]?.chip).toEqual({
      label: 'ended',
      tone: 'neutral',
    });
  });

  it('notes where the app was closed, with the loss when the crash report has it', () => {
    const crashed = recording({
      state: 'recovered',
      segments: [segment(1, { pauseReason: 'user' }), segment(2, { state: 'recovered' })],
    });
    const report = (knownLossSec: number, maxUnseenLossSec: number): RecoveryReport => ({
      sessionId: crashed.sessionId,
      createdAt: crashed.createdAt,
      segments: crashed.segments,
      recoveredSec: 400,
      knownLossSec,
      maxUnseenLossSec,
    });
    const view = playerView(crashed, at(2, 0), report(1.1, 1));
    expect(view.endsInCrash).toBe(true);
    expect(view.items[1]?.note).toBe('The app was closed here. Lost 1.1 to 2.1 s at the end.');
    expect(playerView(crashed, at(2, 0), report(0, 0)).items[1]?.note).toBe(
      'The app was closed here.',
    );
    expect(playerView(crashed, at(2, 0)).items[1]?.note).toBe('The app was closed here.');
    expect(playerView(interview, at(1, 0)).endsInCrash).toBe(false);
  });
});

describe('startingSegment', () => {
  const segments = [segment(1, { state: 'unplayable' }), segment(2), segment(3)];

  it('keeps a requested segment that plays', () => expect(startingSegment(segments, 3)).toBe(3));

  it('falls back to the first segment that plays', () => {
    expect(startingSegment(segments, 1)).toBe(2);
    expect(startingSegment(segments, 9)).toBe(2);
  });

  it('has nothing to start when no segment plays', () =>
    expect(startingSegment([segment(1, { state: 'unplayable' })], 1)).toBeUndefined());
});
