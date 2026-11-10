import type { Meta, StoryObj } from '@storybook/react-native';

import type { CallQuality, TrackStatus } from '@modules/capture-core';

import { QUALITY_LOOK } from '@features/capture/call-labels';
import { participant } from '@test/call-fixtures';
import { rangeOf, selectOf } from '@test/story-controls';

import { participantView } from '../../room-labels';
import { OwnCard, ParticipantCard } from '../participant-card';

const TRACK = selectOf<TrackStatus>({ none: true, live: true, muted: true });

function ParticipantCardStory({
  identity,
  index,
  isSpeaking,
  quality,
  microphone,
  camera,
}: {
  identity: string;
  index: number;
  isSpeaking: boolean;
  quality: CallQuality;
  microphone: TrackStatus;
  camera: TrackStatus;
}) {
  return (
    <ParticipantCard
      participant={participantView(
        participant(identity, { isSpeaking, quality, microphone, camera }),
      )}
      index={index}
    />
  );
}

const meta = {
  title: 'Features/Room/ParticipantCard',
  component: ParticipantCardStory,
  args: {
    identity: 'interviewer',
    index: 0,
    isSpeaking: false,
    quality: 'excellent',
    microphone: 'live',
    camera: 'none',
  },
  argTypes: {
    index: rangeOf(0, 3),
    quality: selectOf(QUALITY_LOOK),
    microphone: TRACK,
    camera: TRACK,
  },
} satisfies Meta<typeof ParticipantCardStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Interviewer: Story = {};
export const Speaking: Story = {
  args: { identity: 'producer', index: 1, isSpeaking: true, camera: 'live' },
};
export const ThisPhone: Story = {
  render: function Render() {
    return (
      <OwnCard
        identity="iphone"
        tracks={[
          { label: '720p 30 fps', tone: 'success', icon: 'video', speaking: false },
          { label: 'Mic', tone: 'success', icon: 'mic', speaking: false },
        ]}
      />
    );
  },
};
