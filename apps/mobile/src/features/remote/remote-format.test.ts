import { describe, expect, it } from '@jest/globals';

import type { HealthSnapshot } from '@modules/capture-core';

import { inRoom, noCall, participant } from '@test/call-fixtures';

import { formatHealthLine, formatRoomLine } from './remote-format';

const health: HealthSnapshot = {
  at: '2026-11-10T09:00:00.000Z',
  camera: { fps: 30, width: 1920, height: 1080 },
  file: { fps: 29.96, droppedFrames: 0, bytes: 482_344_960, segmentSec: 312, writer: 'writing' },
  audio: {
    levelDb: -23.6,
    lastBufferAgeMs: 41.2,
    driftMs: 2.4,
    resyncCount: 1,
    sampleRate: 48_000,
    callLevelDb: -31.7,
  },
  call: {
    sentWidth: 720,
    sentHeight: 1280,
    sentFps: 30,
    bitrateKbps: 1_480.4,
    droppedFrames: 0,
    qualityLimitation: 'none',
  },
  thermal: 'nominal',
  systemPressure: 'nominal',
  audioRoute: { input: 'AirPods Pro (BluetoothHFP)', output: 'AirPods Pro (BluetoothHFP)' },
  diskFreeBytes: 44_237_824_000,
};

describe('formatHealthLine', () => {
  it('puts every pipeline on one line', () =>
    expect(formatHealthLine(health)).toBe(
      'camera 30.0 fps 1920x1080 | file 30.0 fps writing 460.0 MB dropped 0 | ' +
        'audio -24 dB call -32 dB age 41 ms drift 2 ms resync 1 | call 720x1280 30 fps 1480 kbps limit none | ' +
        'route AirPods Pro (BluetoothHFP) -> AirPods Pro (BluetoothHFP) | thermal nominal disk 41.2 GB',
    ));
});

describe('formatRoomLine', () => {
  it('lists everyone with their tracks', () =>
    expect(
      formatRoomLine(
        inRoom([
          participant('interviewer', { isSpeaking: true }),
          participant('producer', { quality: 'good', camera: 'muted' }),
        ]),
      ),
    ).toBe(
      'room mydirector-poc | interviewer excellent mic live camera none speaking | producer good mic live camera muted',
    ));

  it('says when nobody else is in', () =>
    expect(formatRoomLine(inRoom([]))).toBe('room mydirector-poc | nobody else'));

  it('says when the phone is not in a room', () =>
    expect(formatRoomLine(noCall)).toBe('room not joined'));
});
