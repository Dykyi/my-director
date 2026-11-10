import { describe, expect, it } from '@jest/globals';

import type { CallStatus, HealthSnapshot, SessionPhase } from '@modules/capture-core';

import { inRoom, noCall } from '@test/call-fixtures';

import { healthRows } from './health-rows';

const health = (overrides: Partial<HealthSnapshot> = {}): HealthSnapshot => ({
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

const session = (
  phase: SessionPhase,
  call: CallStatus = phase === 'ready' ? noCall : inRoom(),
) => ({ phase, call });

const row = (rows: ReturnType<typeof healthRows>, label: string) =>
  rows.find((candidate) => candidate.label === label);

describe('healthRows', () => {
  it('shows a recording in full', () =>
    expect(healthRows(health(), session('recording'))).toEqual([
      { label: 'Camera', value: '30.0 fps 1920×1080', tone: 'normal' },
      { label: 'File', value: '30.0 fps  212.0 MB  drops 0', tone: 'normal' },
      { label: 'Audio', value: '-18 dB  drift +3 ms', tone: 'normal', meterBars: 4 },
      { label: 'Input', value: 'AirPods Pro (BluetoothHFP)', tone: 'accent' },
      { label: 'Output', value: 'AirPods Pro (BluetoothHFP)', tone: 'accent' },
      { label: 'Call', value: '720×1280 30 fps 1.6 Mbps', tone: 'normal' },
      { label: 'Room', value: 'mydirector-poc · interviewer', tone: 'normal' },
      { label: 'Thermal', value: 'nominal · pressure nominal', tone: 'normal' },
      { label: 'Disk', value: '41.0 GB free', tone: 'normal' },
    ]));

  it('shows the mic as off when no audio arrives outside a recording', () =>
    expect(
      row(
        healthRows(health({ audio: { ...health().audio, lastBufferAgeMs: -1 } }), session('ready')),
        'Audio',
      ),
    ).toEqual({
      label: 'Audio',
      value: 'mic off',
      tone: 'muted',
    }));

  it('flags silence during a recording', () =>
    expect(
      row(
        healthRows(
          health({ audio: { ...health().audio, lastBufferAgeMs: 2_340 } }),
          session('recording'),
        ),
        'Audio',
      ),
    ).toEqual({
      label: 'Audio',
      value: 'no audio for 2.3 s',
      tone: 'error',
    }));

  it('keeps the built-in route plain', () =>
    expect(
      row(
        healthRows(
          health({
            audioRoute: {
              input: 'iPhone Microphone (MicrophoneBuiltIn)',
              output: 'Speaker (Speaker)',
            },
          }),
          session('ready'),
        ),
        'Input',
      )?.tone,
    ).toBe('normal'));

  it('shows an idle writer and a quiet call', () => {
    const rows = healthRows(
      health({
        file: { ...health().file, writer: 'idle' },
        call: { ...health().call, sentWidth: 0, sentHeight: 0, sentFps: 0, bitrateKbps: 0 },
      }),
      session('ready'),
    );
    expect(row(rows, 'File')).toEqual({ label: 'File', value: 'idle', tone: 'muted' });
    expect(row(rows, 'Call')).toEqual({ label: 'Call', value: 'not sending', tone: 'muted' });
  });

  it('flags a failed writer, a limited call and heat', () => {
    const rows = healthRows(
      health({
        file: { ...health().file, writer: 'failed' },
        call: { ...health().call, qualityLimitation: 'bandwidth' },
        thermal: 'serious',
      }),
      session('paused'),
    );
    expect(row(rows, 'File')).toEqual({ label: 'File', value: 'failed · 212.0 MB', tone: 'error' });
    expect(row(rows, 'Call')).toEqual({
      label: 'Call',
      value: '720×1280 30 fps 1.6 Mbps · limited by bandwidth',
      tone: 'warning',
    });
    expect(row(rows, 'Thermal')?.tone).toBe('warning');
  });

  it('shows the room only while joined, and who else is in it', () => {
    expect(row(healthRows(health(), session('ready')), 'Room')).toEqual({
      label: 'Room',
      value: 'not joined',
      tone: 'muted',
    });
    expect(row(healthRows(health(), session('recording', inRoom([]))), 'Room')).toEqual({
      label: 'Room',
      value: 'mydirector-poc · nobody else yet',
      tone: 'warning',
    });
    expect(
      row(
        healthRows(health(), session('recording', { ...inRoom(), state: 'disconnected' })),
        'Room',
      )?.value,
    ).toBe('not joined');
  });
});
