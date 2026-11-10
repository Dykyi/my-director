import type {
  CaptureConfig,
  HealthSnapshot,
  LogEntry,
  RecordingSummary,
  SegmentSummary,
  SessionSnapshot,
} from '@modules/capture-core';

import type { CaptureSessionActions } from '@features/capture/use-native-session';

import { inRoom, noCall } from './call-fixtures';

const MB = 1_024 ** 2;

export const snapshot = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  phase: 'ready',
  segmentIndex: 0,
  recordedSec: 0,
  activeInterruptions: [],
  call: noCall,
  thermal: 'nominal',
  warnings: [],
  ...overrides,
});

export const readySnapshot = snapshot();
export const recordingSnapshot = snapshot({
  phase: 'recording',
  sessionId: '2026-11-10T09-12-33Z-4F2A',
  startedAt: '2026-11-10T09:12:33.000Z',
  segmentIndex: 2,
  recordedSec: 312,
  call: inRoom(),
});
export const sampleHealth = (overrides: Partial<HealthSnapshot> = {}): HealthSnapshot => ({
  at: '2026-11-10T09:00:00.000Z',
  camera: { fps: 30, width: 1920, height: 1080 },
  file: { fps: 29.97, droppedFrames: 0, bytes: 222_298_112, segmentSec: 312, writer: 'writing' },
  audio: { levelDb: -18.2, lastBufferAgeMs: 40, driftMs: 3.2, resyncCount: 0, sampleRate: 48_000 },
  call: {
    sentWidth: 720,
    sentHeight: 1280,
    sentFps: 30,
    bitrateKbps: 1_600,
    droppedFrames: 0,
    qualityLimitation: 'none',
  },
  thermal: 'nominal',
  systemPressure: 'nominal',
  audioRoute: { input: 'AirPods Pro (BluetoothHFP)', output: 'AirPods Pro (BluetoothHFP)' },
  diskFreeBytes: 44_023_414_784,
  ...overrides,
});

export const sampleLogs: LogEntry[] = [
  {
    at: '2026-11-10T09:12:33.120Z',
    mono: 1,
    level: 'info',
    category: 'session',
    message: 'Recording started',
    data: { segment: '1' },
  },
  {
    at: '2026-11-10T09:14:02.410Z',
    mono: 2,
    level: 'warning',
    category: 'call',
    message: 'Call quality poor',
    data: { limitation: 'bandwidth' },
  },
  {
    at: '2026-11-10T09:17:40.003Z',
    mono: 3,
    level: 'info',
    category: 'segment',
    message: 'Segment closed',
    data: { index: '2', bytes: '183 MB' },
  },
];

export const sampleCamera: CaptureConfig['camera'] = {
  position: 'front',
  width: 1920,
  height: 1080,
  fps: 30,
  stabilization: 'off',
};

export const segment = (
  index: number,
  overrides: Partial<SegmentSummary> = {},
): SegmentSummary => ({
  index,
  uri: `file:///Documents/Recordings/s1/segment-00${index}.mov`,
  state: 'finalized',
  durationSec: 238,
  bytes: 183 * MB,
  ...overrides,
});

export const recording = (overrides: Partial<RecordingSummary> = {}): RecordingSummary => ({
  sessionId: '2026-11-10T09-12-33Z-4F2A',
  createdAt: '2026-11-10T09:12:33.000Z',
  state: 'finished',
  segments: [segment(1), segment(2)],
  totalSec: 476,
  totalBytes: 366 * MB,
  ...overrides,
});

const done = async () => true;

export const noopActions: CaptureSessionActions = {
  prepare: done,
  start: done,
  pause: done,
  resume: done,
  reconnectCall: done,
  stop: done,
  dismissError: () => {},
  simulateCrash: () => {},
};
