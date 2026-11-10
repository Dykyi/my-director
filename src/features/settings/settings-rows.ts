import type {
  CallCodec,
  CallDegradation,
  CallVideoProfile,
  CaptureConfig,
  RecordingCodec,
} from '@modules/capture-core';

import type { CallTarget } from '@config/token-grant';

export type SettingsRowView = { label: string; value: string; mono?: boolean };
export type SettingsGroupId = 'camera' | 'file' | 'microphone' | 'call' | 'upload' | 'about';
export type SettingsGroupView = { id: SettingsGroupId; title: string; rows: SettingsRowView[] };
export type AboutInfo = {
  app: string;
  version: string;
  build: string;
  debug: boolean;
  device: string;
};

const BITS_PER_MBIT = 1_000_000;
const BITS_PER_KBIT = 1_000;
const MB_PER_GB = 1_000;
const MS_PER_SEC = 1_000;
const UNKNOWN = '?';
const LENS = 'Wide 1×';
const VIDEO_HDR = 'Off';
const AUDIO_FORMAT = 'AAC 48 kHz mono';
const UPLOAD_STORAGE = 'Backblaze B2 via Worker';

const RECORDING_CODEC: Record<RecordingCodec, string> = { hevc: 'HEVC', h264: 'H.264' };
const CALL_CODEC: Record<CallCodec, string> = { h264: 'H.264', vp8: 'VP8' };
const WEAK_NETWORK: Record<CallDegradation, (fps: number) => string> = {
  maintainFramerate: (fps) => `keeps ${fps} fps, drops size`,
  maintainResolution: () => 'keeps size, drops frame rate',
  balanced: () => 'drops size and frame rate together',
};

const profileText = ({ width, height, fps }: CallVideoProfile) => `${width}×${height} ${fps} fps`;
const gigabytes = (megabytes: number) => `${megabytes / MB_PER_GB} GB`;

function processing({ noiseSuppression, autoGainControl }: CaptureConfig['audio']): string {
  return ['echo cancel', noiseSuppression && 'noise', autoGainControl && 'gain']
    .filter(Boolean)
    .join(' · ');
}

export function settingsGroups(
  config: CaptureConfig,
  about: AboutInfo,
  call: CallTarget,
): SettingsGroupView[] {
  const { camera, recording, audio, health, storage } = config;
  const { codec, degradation, profiles, thermalProfiles, thermalRecoveryDelaySec } = config.call;
  const { standard } = profiles;
  return [
    {
      id: 'camera',
      title: 'CAMERA',
      rows: [
        { label: 'Lens', value: LENS },
        { label: 'Format', value: `${camera.width}×${camera.height} · ${camera.fps} fps locked` },
        { label: 'Stabilization', value: camera.stabilization === 'off' ? 'Off' : 'Standard' },
        { label: 'Video HDR', value: VIDEO_HDR },
      ],
    },
    {
      id: 'file',
      title: 'FILE ON THE PHONE',
      rows: [
        {
          label: 'Video',
          value: `${RECORDING_CODEC[recording.codec]} · ${recording.videoBitrate / BITS_PER_MBIT} Mbit/s`,
        },
        { label: 'Keyframe', value: `every ${recording.keyFrameIntervalSec} s` },
        {
          label: 'Audio',
          value: `${AUDIO_FORMAT} · ${recording.audioBitrate / BITS_PER_KBIT} kbit/s`,
        },
        {
          label: 'Saved to disk',
          value: `every ${recording.fragmentIntervalSec} s (first ${recording.initialFragmentIntervalSec} s)`,
        },
        {
          label: 'Free space',
          value: `${gigabytes(storage.minFreeSpaceToStartMB)} to start · warn at ${gigabytes(storage.lowSpaceWarningMB)}`,
        },
      ],
    },
    {
      id: 'microphone',
      title: 'MICROPHONE',
      rows: [
        { label: 'Processing', value: processing(audio) },
        { label: 'Sync correction', value: `after ${audio.resyncThresholdMs} ms off` },
        {
          label: 'Mic restart grace',
          value: `${(health.micRestartGraceMs / MS_PER_SEC).toFixed(1)} s`,
        },
      ],
    },
    {
      id: 'call',
      title: 'CALL',
      rows: [
        { label: 'LiveKit', value: call.serverUrl, mono: true },
        {
          label: 'Room',
          value: `${call.room ?? UNKNOWN} · as ${call.identity ?? UNKNOWN}`,
          mono: true,
        },
        {
          label: 'Video',
          value: `${CALL_CODEC[codec]} · ${standard.width}×${standard.height} · ${standard.fps} fps`,
        },
        { label: 'Phone hot', value: profileText(profiles[thermalProfiles.serious]) },
        { label: 'Phone critical', value: profileText(profiles[thermalProfiles.critical]) },
        {
          label: `Back to ${standard.height}p`,
          value: `${thermalRecoveryDelaySec} s after it cools`,
        },
        { label: 'Weak network', value: WEAK_NETWORK[degradation](standard.fps) },
      ],
    },
    { id: 'upload', title: 'UPLOAD', rows: [{ label: 'Storage', value: UPLOAD_STORAGE }] },
    {
      id: 'about',
      title: 'ABOUT',
      rows: [
        { label: 'App', value: `${about.app} ${about.version}` },
        {
          label: 'Build',
          value: `${about.debug ? 'debug' : 'release'} · ${about.build}`,
          mono: true,
        },
        { label: 'Device', value: about.device },
      ],
    },
  ];
}
