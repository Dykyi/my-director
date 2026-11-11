import type {
  CallCodec,
  CallDegradation,
  CallVideoProfile,
  CaptureConfig,
  RecordingCodec,
} from '@modules/capture-core';

import { NOT_JOINED, type CallTarget } from '@features/call/call-target';
import { formatResolution } from '@shared/format';
import { BITS_PER_KBIT, BITS_PER_MBIT, MB_PER_GB, MS_PER_SEC } from '@shared/units';

type SettingsRowView = { label: string; value: string; mono?: boolean };
type SettingsGroupId = 'camera' | 'file' | 'microphone' | 'call' | 'upload' | 'about';
export type SettingsGroupView = { id: SettingsGroupId; title: string; rows: SettingsRowView[] };
type UpdateInfo = {
  enabled: boolean;
  embedded: boolean;
  updateId: string | null;
  channel: string | null;
};
export type AboutInfo = {
  app: string;
  version: string;
  build: string;
  debug: boolean;
  device: string;
  os: string;
  runtime: string | null;
  update: UpdateInfo;
};

const SHORT_ID_LENGTH = 8;
/** Fixed in the native pipeline: CameraSource takes the wide lens with video HDR off, SegmentWriter writes mono AAC. */
const LENS = 'Wide 1×';
const VIDEO_HDR = 'Off';
const AUDIO_FORMAT = 'AAC 48 kHz mono';
const UPLOAD_STORAGE = 'Backblaze B2 via Worker';
const JOINS_ON_START = 'joins on Start';

const RECORDING_CODEC: Record<RecordingCodec, string> = { hevc: 'HEVC', h264: 'H.264' };
const CALL_CODEC: Record<CallCodec, string> = { h264: 'H.264', vp8: 'VP8' };
const WEAK_NETWORK: Record<CallDegradation, (fps: number) => string> = {
  maintainFramerate: (fps) => `keeps ${fps} fps, drops size`,
  maintainResolution: () => 'keeps size, drops frame rate',
  balanced: () => 'drops size and frame rate together',
};

const profileText = ({ width, height, fps }: CallVideoProfile) =>
  `${formatResolution(width, height)} ${fps} fps`;
const gigabytes = (megabytes: number) => `${megabytes / MB_PER_GB} GB`;

function processing({ noiseSuppression, autoGainControl }: CaptureConfig['audio']): string {
  return ['echo cancel', noiseSuppression && 'noise', autoGainControl && 'gain']
    .filter(Boolean)
    .join(' · ');
}

function interviewerVoice({ mixCallAudio, callAudioGainDb }: CaptureConfig['audio']): string {
  if (!mixCallAudio) return 'not in the file';
  const mixed = 'mixed in from the call';
  if (callAudioGainDb === 0) return mixed;
  return `${mixed} · ${callAudioGainDb > 0 ? '+' : ''}${callAudioGainDb} dB`;
}

function savedToDisk({
  fragmentIntervalSec,
  initialFragmentIntervalSec,
}: CaptureConfig['recording']) {
  const every = `every ${fragmentIntervalSec} s`;
  return initialFragmentIntervalSec === fragmentIntervalSec
    ? every
    : `${every} (first ${initialFragmentIntervalSec} s)`;
}

function updateText({ enabled, embedded, updateId, channel }: UpdateInfo): string {
  if (!enabled) return 'Off';
  const source =
    embedded || !updateId ? 'built-in bundle' : `update ${updateId.slice(0, SHORT_ID_LENGTH)}`;
  return channel ? `${source} · ${channel}` : source;
}

export function settingsGroups(
  config: CaptureConfig,
  about: AboutInfo,
  call: CallTarget | undefined,
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
        {
          label: 'Format',
          value: `${formatResolution(camera.width, camera.height)} · ${camera.fps} fps locked`,
        },
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
        { label: 'Interviewer', value: interviewerVoice(audio) },
        { label: 'Saved to disk', value: savedToDisk(recording) },
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
        { label: 'LiveKit', value: call?.serverUrl ?? JOINS_ON_START, mono: call !== undefined },
        {
          label: 'Room',
          value: call ? `${call.room} · as ${call.identity}` : NOT_JOINED,
          mono: call !== undefined,
        },
        {
          label: 'Video',
          value: `${CALL_CODEC[codec]} · ${formatResolution(standard.width, standard.height)} · ${standard.fps} fps`,
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
        { label: 'Runtime', value: about.runtime ?? 'not set', mono: true },
        { label: 'Update', value: updateText(about.update), mono: true },
        { label: 'Device', value: `${about.device} · ${about.os}` },
      ],
    },
  ];
}
