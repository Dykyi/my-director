import type {
  CallStatus,
  CallVideoProfile,
  ParticipantStatus,
  TrackStatus,
} from '@modules/capture-core';

import { mbps, QUALITY_LOOK, type QualityLook } from '@features/capture/call-labels';
import { formatClock, plural } from '@shared/format';
import type { IconName } from '@ui/icons';
import type { ChipTone } from '@ui/tone';

export type RoomView = 'notJoined' | 'empty' | 'occupied';
export type TrackKind = 'mic' | 'camera';
export type TrackChipView = { label: string; tone: ChipTone; icon: IconName; speaking: boolean };
export type ParticipantView = {
  name: string;
  initials: string;
  joined: string;
  speaking: boolean;
  quality: QualityLook;
  tracks: TrackChipView[];
};
export type ConnectionView = {
  title: string;
  detail?: string;
  live: boolean;
  text?: string;
  chip: QualityLook | { label: string; tone: ChipTone };
};

const TRACK_NAME: Record<TrackKind, string> = { mic: 'Mic', camera: 'Camera' };
const TRACK_ICON: Record<TrackKind, Record<'on' | 'off', IconName>> = {
  mic: { on: 'mic', off: 'mic-off' },
  camera: { on: 'video', off: 'video-off' },
};
const INITIALS_LENGTH = 2;
const WORD = /[\p{L}\d]+/gu;

export function initials(identity: string): string {
  const words = identity.match(WORD) ?? [identity];
  const letters =
    words.length > 1 ? words.map((word) => word.charAt(0)).join('') : (words[0] ?? '');
  return letters.slice(0, INITIALS_LENGTH).toUpperCase();
}

export function roomView({ state, room, participants }: CallStatus): RoomView {
  if (state === 'disconnected' || room === undefined) return 'notJoined';
  return participants.length === 0 ? 'empty' : 'occupied';
}

function trackChip(kind: TrackKind, status: TrackStatus, speaking: boolean): TrackChipView {
  switch (status) {
    case 'live':
      return {
        label: `${TRACK_NAME[kind]} live`,
        tone: 'success',
        icon: TRACK_ICON[kind].on,
        speaking,
      };
    case 'muted':
      return {
        label: `${TRACK_NAME[kind]} muted`,
        tone: 'paused',
        icon: TRACK_ICON[kind].off,
        speaking: false,
      };
    case 'none':
      return { label: `No ${kind}`, tone: 'neutral', icon: TRACK_ICON[kind].on, speaking: false };
  }
}

export function participantView({
  identity,
  joinedAt,
  isSpeaking,
  quality,
  microphone,
  camera,
}: ParticipantStatus): ParticipantView {
  const joined = joinedAt === undefined ? 'in the room' : `joined ${formatClock(joinedAt)}`;
  return {
    name: identity,
    initials: initials(identity),
    joined: isSpeaking ? `${joined} · speaking` : joined,
    speaking: isSpeaking,
    quality: QUALITY_LOOK[quality],
    tracks: [trackChip('mic', microphone, isSpeaking), trackChip('camera', camera, false)],
  };
}

export function connectionView({
  state,
  connectedAt,
  reconnectCount,
  quality,
}: CallStatus): ConnectionView {
  switch (state) {
    case 'disconnected':
      return {
        title: 'Not joined',
        live: false,
        text: 'The phone joins this room when you start recording and leaves it on Stop. Who is in the room shows here after that.',
        chip: { label: 'offline', tone: 'neutral' },
      };
    case 'connecting':
    case 'reconnecting':
      return {
        title: state === 'connecting' ? 'Joining…' : 'Reconnecting…',
        live: false,
        chip: { label: 'joining', tone: 'paused' },
      };
    case 'connected': {
      const since = connectedAt === undefined ? undefined : `since ${formatClock(connectedAt)}`;
      const reconnects = reconnectCount > 0 ? plural(reconnectCount, 'reconnect') : undefined;
      return {
        title: 'Connected',
        detail: [since, reconnects].filter(Boolean).join(' · '),
        live: true,
        chip: QUALITY_LOOK[quality],
      };
    }
  }
}

export function ownTracks(
  call: CallStatus,
  profile: CallVideoProfile,
  bitrateKbps: number | undefined,
): TrackChipView[] {
  const video = `${profile.height}p ${profile.fps} fps`;
  if (call.state !== 'connected') {
    return [
      { label: `Camera ${video}`, tone: 'neutral', icon: TRACK_ICON.camera.on, speaking: false },
      { label: 'Mic off until Start', tone: 'neutral', icon: TRACK_ICON.mic.on, speaking: false },
    ];
  }
  if (call.isMuted) return [trackChip('camera', 'muted', false), trackChip('mic', 'muted', false)];
  const sending = bitrateKbps ? `${video} · ${mbps(bitrateKbps)}` : video;
  return [
    { label: `Camera ${sending}`, tone: 'success', icon: TRACK_ICON.camera.on, speaking: false },
    trackChip('mic', 'live', false),
  ];
}

export const peopleHeading = ({ participants }: CallStatus) =>
  `IN THE ROOM · ${participants.length}`;
export const ownHeading = (view: RoomView) => (view === 'notJoined' ? 'YOU WILL SEND' : 'YOU');
