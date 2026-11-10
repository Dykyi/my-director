import { describe, expect, it } from '@jest/globals';

import type { CaptureConfig } from '@modules/capture-core';

import { settingsGroups, type AboutInfo } from './settings-rows';

const config: CaptureConfig = {
  camera: { position: 'back', width: 1920, height: 1080, fps: 30, stabilization: 'off' },
  recording: {
    codec: 'hevc',
    videoBitrate: 6_000_000,
    keyFrameIntervalSec: 1,
    audioBitrate: 128_000,
    fragmentIntervalSec: 1,
    initialFragmentIntervalSec: 1,
  },
  call: {
    codec: 'h264',
    simulcast: false,
    degradation: 'maintainFramerate',
    profiles: {
      standard: { width: 1280, height: 720, fps: 30 },
      reduced: { width: 960, height: 540, fps: 24 },
      minimal: { width: 640, height: 360, fps: 15 },
    },
    thermalProfiles: {
      nominal: 'standard',
      fair: 'standard',
      serious: 'reduced',
      critical: 'minimal',
    },
    thermalRecoveryDelaySec: 60,
    connectTimeoutSec: 15,
  },
  audio: { noiseSuppression: true, autoGainControl: true, resyncThresholdMs: 40 },
  session: { resumePolicy: 'manual', heartbeatIntervalSec: 0.5, resumeTimeoutMs: 3_000 },
  health: {
    videoStallMs: 1_000,
    audioStallMs: 1_000,
    fileStallMs: 5_000,
    micRestartGraceMs: 3_000,
  },
  storage: { minFreeSpaceToStartMB: 2_000, lowSpaceWarningMB: 1_000, criticalFreeSpaceMB: 500 },
};
const about: AboutInfo = {
  app: 'MyDirector',
  version: '0.1.0',
  build: '1',
  debug: true,
  device: 'iPhone 11',
  os: 'iOS 26.1',
  runtime: '4f2a9c1e',
  update: { enabled: false, embedded: true, updateId: null, channel: null },
};
const call = {
  serverUrl: 'wss://mydirector-poc-abc.livekit.cloud',
  room: 'mydirector-poc',
  identity: 'iphone',
};
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

describe('saved to disk', () => {
  it('names the first fragment when it is shorter', () => {
    const slow = { ...config, recording: { ...config.recording, fragmentIntervalSec: 2 } };
    const fileRows = settingsGroups(slow, about, call).find((group) => group.id === 'file')?.rows;
    expect(fileRows?.find((row) => row.label === 'Saved to disk')?.value).toBe(
      'every 2 s (first 1 s)',
    );
  });
});
