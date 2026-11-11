import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clampQuietSec,
  clampReadingMinutes,
  DEFAULT_SETTINGS,
  MAX_QUIET_SEC,
  MAX_READING_MINUTES,
  MIN_QUIET_SEC,
  MIN_READING_MINUTES,
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
    assert.equal(DEFAULT_SETTINGS.mode, 'questions');
    assert.equal(DEFAULT_SETTINGS.readingMinutes, 10);
    assert.equal(DEFAULT_SETTINGS.hearVoice, false);
    store.save({ ...DEFAULT_SETTINGS, quietSec: 12, mode: 'reading', readingMinutes: 15 });
    assert.deepEqual(store.load(), {
      ...DEFAULT_SETTINGS,
      quietSec: 12,
      mode: 'reading',
      readingMinutes: 15,
    });
  });

  it('asks questions when the saved mode is not one it knows', () => {
    const storage = memoryStorage();
    storage.setItem('interviewer.settings', JSON.stringify({ mode: 'singing' }));
    assert.equal(new SettingsStore(storage).load().mode, 'questions');
  });

  it('drops broken, unknown and wrongly typed values', () => {
    const storage = memoryStorage();
    const store = new SettingsStore(storage);
    storage.setItem('interviewer.settings', JSON.stringify({ quietSec: '12', extra: 1 }));
    assert.deepEqual(store.load(), DEFAULT_SETTINGS);
    storage.setItem('interviewer.settings', '{oops');
    assert.deepEqual(store.load(), DEFAULT_SETTINGS);
  });

  it('keeps the edited reading text apart from the script', () => {
    const store = new SettingsStore(memoryStorage());
    store.saveScript('Only question?');
    store.saveReading('One paragraph.');
    assert.equal(store.loadScript(), 'Only question?');
    assert.equal(store.loadReading(), 'One paragraph.');
  });

  it('forgets the settings and the edited texts on reset', () => {
    const store = new SettingsStore(memoryStorage());
    store.save({ ...DEFAULT_SETTINGS, room: 'other' });
    store.saveScript('Only question?');
    store.saveReading('One paragraph.');
    store.reset();
    assert.equal(store.loadScript(), null);
    assert.equal(store.loadReading(), null);
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

describe('clampReadingMinutes', () => {
  it('takes whole minutes in the range and keeps the old value for an empty field', () => {
    assert.equal(clampReadingMinutes(0, 10), 10);
    assert.equal(clampReadingMinutes(Number(''), 10), 10);
    assert.equal(clampReadingMinutes(0.2, 10), MIN_READING_MINUTES);
    assert.equal(clampReadingMinutes(90, 10), MAX_READING_MINUTES);
    assert.equal(clampReadingMinutes(7.4, 10), 7);
  });
});
