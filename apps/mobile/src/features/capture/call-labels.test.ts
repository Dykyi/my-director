import { describe, expect, it } from '@jest/globals';

import { inRoom, participant } from '@test/call-fixtures';

import { participantNames, roomName } from './call-labels';

describe('participantNames', () => {
  it('lists everyone else in the room in the order given', () =>
    expect(participantNames(inRoom([participant('interviewer'), participant('producer')]))).toEqual(
      ['interviewer', 'producer'],
    ));
});

describe('roomName', () => {
  it('prefers the room the phone joined', () =>
    expect(roomName(inRoom([]), 'last-join')).toBe(inRoom([]).room));
  it('falls back to the room of the last join, then says there was none', () => {
    expect(roomName({ ...inRoom([]), room: undefined }, 'last-join')).toBe('last-join');
    expect(roomName({ ...inRoom([]), room: undefined }, undefined)).toBe('not joined yet');
  });
});
