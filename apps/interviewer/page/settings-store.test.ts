import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clampQuietSec,
  clampSceneScale,
  clampTalkMinutes,
  DEFAULT_SETTINGS,
  hearsOnMac,
  MAX_QUIET_SEC,
  MAX_SCENE_SCALE,
  MAX_TALK_MINUTES,
  MIN_QUIET_SEC,
  MIN_SCENE_SCALE,
  MIN_TALK_MINUTES,
  SettingsStore,
  stepSceneScale,
  usesMicrophone,
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
    assert.equal(DEFAULT_SETTINGS.talkMinutes, 10);
    assert.equal(DEFAULT_SETTINGS.hearVoice, false);
    store.save({ ...DEFAULT_SETTINGS, quietSec: 12, mode: 'reading', talkMinutes: 15 });
    assert.deepEqual(store.load(), {
      ...DEFAULT_SETTINGS,
      quietSec: 12,
      mode: 'reading',
      talkMinutes: 15,
    });
  });

  it('keeps the demo mode and its guest voice, which is Daniel at first', () => {
    const store = new SettingsStore(memoryStorage());
    assert.equal(DEFAULT_SETTINGS.guestVoice, 'Daniel');
    store.save({ ...DEFAULT_SETTINGS, mode: 'demo', guestVoice: 'Karen' });
    assert.deepEqual(store.load(), { ...DEFAULT_SETTINGS, mode: 'demo', guestVoice: 'Karen' });
  });

  it('starts the talk length over at the default after the reading length was saved', () => {
    const storage = memoryStorage();
    storage.setItem('interviewer.settings', JSON.stringify({ readingMinutes: 25 }));
    assert.deepEqual(new SettingsStore(storage).load(), DEFAULT_SETTINGS);
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

describe('clampTalkMinutes', () => {
  it('takes whole minutes in the range and keeps the old value for an empty field', () => {
    assert.equal(clampTalkMinutes(0, 10), 10);
    assert.equal(clampTalkMinutes(Number(''), 10), 10);
    assert.equal(clampTalkMinutes(0.2, 10), MIN_TALK_MINUTES);
    assert.equal(clampTalkMinutes(90, 10), MAX_TALK_MINUTES);
    assert.equal(clampTalkMinutes(7.4, 10), 7);
  });
});

describe('hearsOnMac', () => {
  it('plays what the switch asks for, and nothing in Demo, where the phone listens to this Mac', () => {
    const demo = { ...DEFAULT_SETTINGS, mode: 'demo' as const };
    assert.equal(hearsOnMac(DEFAULT_SETTINGS, true), true);
    assert.equal(hearsOnMac(DEFAULT_SETTINGS, false), false);
    assert.equal(hearsOnMac(demo, true), false);
  });
});

describe('usesMicrophone', () => {
  it("sends this Mac's microphone only when it asks, and never in Demo, where it would catch the guest", () => {
    const microphone = { ...DEFAULT_SETTINGS, asker: 'microphone' as const };
    assert.equal(usesMicrophone(DEFAULT_SETTINGS), false);
    assert.equal(usesMicrophone(microphone), true);
    assert.equal(usesMicrophone({ ...microphone, mode: 'demo' }), false);
  });
});

describe('scene scale', () => {
  it('starts at 0.8 and steps by a tenth between the smallest and the full scene', () => {
    assert.equal(DEFAULT_SETTINGS.sceneScale, 0.8);
    assert.equal(stepSceneScale(0.8, 1), 0.9);
    assert.equal(stepSceneScale(stepSceneScale(0.8, 1), 1), 1);
    assert.equal(stepSceneScale(0.8, -1), 0.7);
    assert.equal(stepSceneScale(MAX_SCENE_SCALE, 1), MAX_SCENE_SCALE);
    assert.equal(stepSceneScale(MIN_SCENE_SCALE, -1), MIN_SCENE_SCALE);
  });

  it('snaps to tenths in the range', () => {
    assert.equal(clampSceneScale(0.2), MIN_SCENE_SCALE);
    assert.equal(clampSceneScale(1.7), MAX_SCENE_SCALE);
    assert.equal(clampSceneScale(0.7000000000000001), 0.7);
  });

  it('keeps the saved scale', () => {
    const store = new SettingsStore(memoryStorage());
    store.save({ ...DEFAULT_SETTINGS, sceneScale: 0.6 });
    assert.equal(store.load().sceneScale, 0.6);
  });
});
