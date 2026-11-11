import { describe, expect, it } from '@jest/globals';

import { sampleAbout, sampleCallTarget, sampleConfig } from '@test/settings-fixtures';

import { settingsGroups, type AboutInfo } from './settings-rows';

const config = sampleConfig;
const about = sampleAbout;
const call = sampleCallTarget;
const groups = settingsGroups(config, about, call);
const rows = (id: string) =>
  groups.find((group) => group.id === id)?.rows.map(({ label, value }) => [label, value]);

describe('settingsGroups', () => {
  it('describes the camera as the canvas does', () =>
    expect(rows('camera')).toEqual([
      ['Lens', 'Wide 1×'],
      ['Format', '1920×1080 · 30 fps locked'],
      ['Stabilization', 'Off'],
      ['Video HDR', 'Off'],
    ]));

  it('describes the file', () =>
    expect(rows('file')).toEqual([
      ['Video', 'HEVC · 6 Mbit/s'],
      ['Keyframe', 'every 1 s'],
      ['Audio', 'AAC 48 kHz mono · 128 kbit/s'],
      ['Interviewer', 'mixed in from the call'],
      ['Saved to disk', 'every 1 s'],
      ['Free space', '2 GB to start · warn at 1 GB'],
    ]));

  it('describes the microphone', () =>
    expect(rows('microphone')).toEqual([
      ['Processing', 'echo cancel · noise · gain'],
      ['Sync correction', 'after 40 ms off'],
      ['Mic restart grace', '3.0 s'],
    ]));

  it('describes the call', () =>
    expect(rows('call')).toEqual([
      ['LiveKit', 'wss://mydirector-poc-abc.livekit.cloud'],
      ['Room', 'mydirector-poc · as iphone'],
      ['Video', 'H.264 · 1280×720 · 30 fps'],
      ['Phone hot', '960×540 24 fps'],
      ['Phone critical', '640×360 15 fps'],
      ['Back to 720p', '60 s after it cools'],
      ['Weak network', 'keeps 30 fps, drops size'],
    ]));

  it('says the call joins on Start before the first join', () =>
    expect(
      settingsGroups(config, about, undefined)
        .find((group) => group.id === 'call')
        ?.rows.slice(0, 2)
        .map(({ label, value }) => [label, value]),
    ).toEqual([
      ['LiveKit', 'joins on Start'],
      ['Room', 'not joined yet'],
    ]));

  it('ends with the app, its update and the phone', () =>
    expect(rows('about')).toEqual([
      ['App', 'MyDirector 0.1.0'],
      ['Build', 'debug · 1'],
      ['Runtime', '4f2a9c1e'],
      ['Update', 'Off'],
      ['Device', 'iPhone 11 · iOS 26.1'],
    ]));

  describe('update row', () => {
    const update = (overrides: Partial<AboutInfo['update']>) =>
      settingsGroups(
        config,
        { ...about, update: { ...about.update, enabled: true, ...overrides } },
        call,
      )
        .find((group) => group.id === 'about')
        ?.rows.find((row) => row.label === 'Update')?.value;

    it('names the bundle built into the app', () =>
      expect(update({ channel: 'production' })).toBe('built-in bundle · production'));
    it('shortens the id of a downloaded update', () =>
      expect(
        update({
          embedded: false,
          updateId: '0195b3c4-7d1e-7a2b-9c3d-4e5f6a7b8c9d',
          channel: 'production',
        }),
      ).toBe('update 0195b3c4 · production'));
  });
});

describe('interviewer in the file', () => {
  const interviewer = (audio: Partial<typeof config.audio>) =>
    settingsGroups({ ...config, audio: { ...config.audio, ...audio } }, about, call)
      .find((group) => group.id === 'file')
      ?.rows.find((row) => row.label === 'Interviewer')?.value;

  it('names the gain when it is not zero', () => {
    expect(interviewer({ callAudioGainDb: -6 })).toBe('mixed in from the call · -6 dB');
    expect(interviewer({ callAudioGainDb: 3 })).toBe('mixed in from the call · +3 dB');
  });

  it('says when the file holds only the phone', () =>
    expect(interviewer({ mixCallAudio: false })).toBe('not in the file'));
});

describe('saved to disk', () => {
  it('names the first fragment when it is shorter', () => {
    const slow = { ...config, recording: { ...config.recording, fragmentIntervalSec: 2 } };
    const fileRows = settingsGroups(slow, about, call).find((group) => group.id === 'file')?.rows;
    expect(fileRows?.find((row) => row.label === 'Saved to disk')?.value).toBe(
      'every 2 s (first 1 s)',
    );
  });
});
