import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clampQuietSec,
  DEFAULT_SETTINGS,
  MAX_QUIET_SEC,
  MIN_QUIET_SEC,
  SettingsStore,
  type KeyValueStorage,
} from './settings-store.ts';

function memoryStorage(): KeyValueStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

describe('SettingsStore', () => {
  it('starts at the defaults and keeps what was saved', () => {
    const store = new SettingsStore(memoryStorage());
    assert.deepEqual(store.load(), DEFAULT_SETTINGS);
    store.save({ ...DEFAULT_SETTINGS, quietSec: 12 });
    assert.equal(store.load().quietSec, 12);
  });

  it('drops broken, unknown and wrongly typed values', () => {
    const storage = memoryStorage();
    const store = new SettingsStore(storage);
    storage.setItem('interviewer.settings', JSON.stringify({ quietSec: '12', extra: 1 }));
    assert.deepEqual(store.load(), DEFAULT_SETTINGS);
    storage.setItem('interviewer.settings', '{oops');
    assert.deepEqual(store.load(), DEFAULT_SETTINGS);
  });

  it('forgets the settings and the edited script on reset', () => {
    const store = new SettingsStore(memoryStorage());
    store.save({ ...DEFAULT_SETTINGS, room: 'other' });
    store.saveScript('Only question?');
    store.reset();
    assert.equal(store.loadScript(), null);
    assert.deepEqual(store.load(), DEFAULT_SETTINGS);
  });
});

describe('clampQuietSec', () => {
  it('snaps to the range and keeps the old value for an empty field', () => {
    assert.equal(clampQuietSec(1, 20), MIN_QUIET_SEC);
    assert.equal(clampQuietSec(999, 20), MAX_QUIET_SEC);
    assert.equal(clampQuietSec(12.4, 20), 12);
    assert.equal(clampQuietSec(Number(''), 20), 20);
    assert.equal(clampQuietSec(Number('abc'), 20), 20);
  });
});
