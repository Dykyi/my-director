import { describe, expect, it } from '@jest/globals';

import { redirectSystemPath } from '@app/+native-intent';

import { STAND_ROUTES, standAction } from './stand-routes';

describe('standAction', () => {
  it.each(['com.dykyi.mydirector.capturepoc://stand/start', '/stand/start', 'stand/start'])(
    'reads %s',
    (path) => expect(standAction(path)).toBe('start'),
  );
  it('ignores other links', () => expect(standAction('/recordings')).toBeUndefined());
});

describe('redirectSystemPath', () => {
  it('keeps stand links from navigating', () =>
    expect(
      redirectSystemPath({ path: 'com.dykyi.mydirector.capturepoc://stand/debug', initial: false }),
    ).toBeNull());
  it('passes other links through', () =>
    expect(redirectSystemPath({ path: '/room', initial: true })).toBe('/room'));
});

describe('STAND_ROUTES', () => {
  it('maps the screen commands to routes', () =>
    expect(STAND_ROUTES).toEqual({
      back: '/',
      recordings: '/recordings',
      debug: '/debug',
      settings: '/settings',
      room: '/room',
      storybook: '/storybook',
    }));
});
