import { describe, expect, it } from '@jest/globals';

import { parseCallTarget } from './call-target';

const TARGET = {
  serverUrl: 'wss://mydirector-poc.livekit.cloud',
  room: 'mydirector-poc',
  identity: 'iphone-7F3A',
};

describe('parseCallTarget', () => {
  it('reads back a saved target', () =>
    expect(parseCallTarget(JSON.stringify(TARGET))).toEqual(TARGET));
  it('has nothing before the first join', () => expect(parseCallTarget(null)).toBeUndefined());
  it('drops an incomplete or unreadable target', () => {
    expect(parseCallTarget(JSON.stringify({ ...TARGET, room: undefined }))).toBeUndefined();
    expect(parseCallTarget('{"serverUrl"')).toBeUndefined();
  });
});
