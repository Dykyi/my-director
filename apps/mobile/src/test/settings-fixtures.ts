import type { CaptureConfig } from '@modules/capture-core';

import type { AboutInfo } from '@features/settings/settings-rows';

export const sampleConfig: CaptureConfig = {
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
  audio: {
    noiseSuppression: true,
    autoGainControl: true,
    resyncThresholdMs: 40,
    mixCallAudio: true,
    callAudioGainDb: 0,
  },
  session: { resumePolicy: 'manual', heartbeatIntervalSec: 0.5, resumeTimeoutMs: 3_000 },
  health: {
    videoStallMs: 1_000,
    audioStallMs: 1_000,
    fileStallMs: 5_000,
    micRestartGraceMs: 3_000,
  },
  storage: { minFreeSpaceToStartMB: 2_000, lowSpaceWarningMB: 1_000, criticalFreeSpaceMB: 500 },
};
export const sampleAbout: AboutInfo = {
  app: 'MyDirector',
  version: '0.1.0',
  build: '1',
  debug: true,
  device: 'iPhone 11',
  os: 'iOS 26.1',
  runtime: '4f2a9c1e',
  update: { enabled: false, embedded: true, updateId: null, channel: null },
};
export const sampleCallTarget = {
  serverUrl: 'wss://mydirector-poc-abc.livekit.cloud',
  room: 'mydirector-poc',
  identity: 'iphone',
};
