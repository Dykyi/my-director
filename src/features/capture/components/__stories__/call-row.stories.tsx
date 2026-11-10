import type { Meta, StoryObj } from '@storybook/react-native';

import type { CallConnectionState, CallQuality } from '@modules/capture-core';

import { inRoom, participant } from '@test/call-fixtures';
import { readySnapshot, recordingSnapshot } from '@test/session-fixtures';
import { rangeOf, selectOf } from '@test/story-controls';

import { QUALITY_LOOK } from '../../call-labels';
import { callRowView } from '../../record-views';
import { CallRow } from '../call-row';

const PROFILES = {
  standard: { width: 1280, height: 720, fps: 30 },
  reduced: { width: 960, height: 540, fps: 24 },
  minimal: { width: 640, height: 360, fps: 15 },
};
const PEOPLE = ['interviewer', 'producer', 'editor'];

function CallRowStory({
  inSession,
  state,
  people,
  quality,
  muted,
  room,
}: {
  inSession: boolean;
  state: CallConnectionState;
  people: number;
  quality: CallQuality;
  muted: boolean;
  room: string;
}) {
  const call = {
    ...inRoom(PEOPLE.slice(0, people).map((name) => participant(name))),
    state,
    quality,
    isMuted: muted,
  };
  const snapshot = inSession ? { ...recordingSnapshot, call } : readySnapshot;
  return <CallRow view={callRowView(snapshot, PROFILES, room)} onPress={() => {}} />;
}

const meta = {
  title: 'Features/Record/CallRow',
  component: CallRowStory,
  args: {
    inSession: false,
    state: 'connected',
    people: 1,
    quality: 'excellent',
    muted: false,
    room: 'mydirector-poc',
  },
  argTypes: {
    state: selectOf<CallConnectionState>({
      disconnected: true,
      connecting: true,
      connected: true,
      reconnecting: true,
    }),
    people: rangeOf(0, PEOPLE.length),
    quality: selectOf(QUALITY_LOOK),
  },
  parameters: { inset: 'none' },
} satisfies Meta<typeof CallRowStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotJoined: Story = {};
export const Interviewer: Story = { args: { inSession: true } };
export const TwoOthers: Story = { args: { inSession: true, people: 2 } };
export const Waiting: Story = { args: { inSession: true, people: 0 } };
export const Muted: Story = { args: { inSession: true, muted: true } };
export const Dropped: Story = { args: { inSession: true, state: 'reconnecting' } };
