import { describe, expect, it, jest } from '@jest/globals';

import { parsePreference, storedPreference } from './stored-preference';

jest.mock('expo-sqlite/kv-store', () => {
  const items = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItemSync: (key: string) => items.get(key) ?? null,
      setItemSync: (key: string, value: string) => void items.set(key, value),
      removeItemSync: (key: string) => items.delete(key),
    },
  };
});

const SIDES = ['left', 'right'] as const;

describe('parsePreference', () => {
  it('keeps a known value', () => expect(parsePreference('left', SIDES)).toBe('left'));
  it('drops an unknown or missing value', () => {
    expect(parsePreference('up', SIDES)).toBeUndefined();
    expect(parsePreference(null, SIDES)).toBeUndefined();
  });
});

describe('storedPreference', () => {
  it('keeps a value for the next launch', () => {
    storedPreference('test.side', SIDES).set('right');
    expect(storedPreference('test.side', SIDES).get()).toBe('right');
  });

  it('forgets a cleared value', () => {
    const side = storedPreference('test.cleared', SIDES);
    side.set('left');
    side.set(undefined);
    expect(storedPreference('test.cleared', SIDES).get()).toBeUndefined();
  });
});
