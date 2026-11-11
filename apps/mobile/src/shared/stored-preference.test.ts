import { describe, expect, it, jest } from '@jest/globals';

import { memoryKvStore as mockKvStore } from '@test/memory-kv-store';

import { parsePreference, storedPreference, storedValue } from './stored-preference';

jest.mock('expo-sqlite/kv-store', () => mockKvStore);

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

describe('storedValue', () => {
  const count = (key: string) =>
    storedValue(key, (stored) => (stored === null ? undefined : Number(stored)), String);

  it('has nothing until a value is saved', () => expect(count('test.empty').get()).toBeUndefined());

  it('saves a value for the next launch and tells its readers', () => {
    const value = count('test.count');
    const listener = jest.fn();
    value.subscribe(listener);
    value.set(3);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(count('test.count').get()).toBe(3);
  });

  it('removes a value set to undefined', () => {
    const value = count('test.removed');
    value.set(7);
    value.set(undefined);
    expect(count('test.removed').get()).toBeUndefined();
  });
});
