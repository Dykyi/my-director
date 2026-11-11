import { describe, expect, it } from '@jest/globals';

import { formatClock } from '@shared/format';
import { inRoom, noCall, participant } from '@test/call-fixtures';

import {
  connectionView,
  initials,
  ownIdentity,
  ownTracks,
  participantView,
  roomOccupancy,
} from './room-labels';

const STANDARD = { width: 1280, height: 720, fps: 30 };

describe('initials', () => {
  it.each([
    ['interviewer', 'IN'],
    ['producer', 'PR'],
    ['john smith', 'JS'],
  ])('%s → %s', (identity, expected) => expect(initials(identity)).toBe(expected));
});

describe('roomOccupancy', () => {
  it('is not joined before Start', () => expect(roomOccupancy(noCall)).toBe('notJoined'));
  it('is empty with nobody else', () => expect(roomOccupancy(inRoom([]))).toBe('empty'));
  it('is occupied with the interviewer', () => expect(roomOccupancy(inRoom())).toBe('occupied'));
});

describe('participantView', () => {
  it('says when they joined and that they speak', () =>
    expect(participantView(participant('interviewer', { isSpeaking: true }))).toMatchObject({
      name: 'interviewer',
      initials: 'IN',
      joined: `joined ${formatClock('2026-11-10T09:17:40.000Z')} · speaking`,
      tracks: [
        { label: 'Mic live', tone: 'success', icon: 'mic', speaking: true },
        { label: 'No camera', tone: 'neutral', icon: 'video', speaking: false },
      ],
    }));

  it('marks a muted camera', () =>
    expect(participantView(participant('producer', { camera: 'muted' })).tracks[1]).toEqual({
      label: 'Camera muted',
      tone: 'paused',
      icon: 'video-off',
      speaking: false,
    }));
});

describe('connectionView', () => {
  it('explains when the phone joins', () =>
    expect(connectionView(noCall)).toMatchObject({
      title: 'Not joined',
      chip: { label: 'offline', tone: 'neutral' },
    }));
  it('shows since when and the reconnects', () =>
    expect(connectionView({ ...inRoom(), reconnectCount: 2 })).toMatchObject({
      title: 'Connected',
      detail: `since ${formatClock('2026-11-10T09:18:03.000Z')} · 2 reconnects`,
    }));
});

describe('ownTracks', () => {
  it('says what the phone will send before Start', () =>
    expect(ownTracks(noCall, STANDARD, undefined).map((track) => track.label)).toEqual([
      'Camera 720p 30 fps',
      'Mic off until Start',
    ]));
  it('adds the bitrate once sending', () =>
    expect(ownTracks(inRoom(), STANDARD, 1_200).map((track) => track.label)).toEqual([
      'Camera 720p 30 fps · 1.2 Mbps',
      'Mic live',
    ]));
  it('shows both muted while paused', () =>
    expect(
      ownTracks({ ...inRoom(), isMuted: true }, STANDARD, 0).map((track) => track.label),
    ).toEqual(['Camera muted', 'Mic muted']));
});

describe('ownIdentity', () => {
  it('takes the identity of the call the phone is in', () =>
    expect(ownIdentity({ ...inRoom(), identity: 'iphone-7F3A' }, 'iphone-OLD1')).toBe(
      'iphone-7F3A',
    ));
  it('keeps the identity of the last join between calls', () =>
    expect(ownIdentity(noCall, 'iphone-7F3A')).toBe('iphone-7F3A'));
  it('has none before the first join', () =>
    expect(ownIdentity(noCall, undefined)).toBe('not joined yet'));
});
