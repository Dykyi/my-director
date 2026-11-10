import type { Meta, StoryObj } from '@storybook/react-native';

import { iconControl, selectOf } from '@test/story-controls';
import type { IconName } from '@ui/icons';
import type { ChipTone } from '@ui/tone';

import { TrackChip } from '../track-chip';

function TrackChipStory(track: {
  label: string;
  tone: ChipTone;
  icon: IconName;
  speaking: boolean;
}) {
  return <TrackChip track={track} />;
}

const meta = {
  title: 'Features/Room/TrackChip',
  component: TrackChipStory,
  args: { label: 'Mic', tone: 'success', icon: 'mic', speaking: false },
  argTypes: {
    tone: selectOf<ChipTone>({
      neutral: true,
      recording: true,
      paused: true,
      accent: true,
      success: true,
      danger: true,
    }),
    icon: iconControl,
  },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof TrackChipStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Live: Story = {};
export const Speaking: Story = { args: { tone: 'accent', speaking: true } };
export const Off: Story = { args: { label: 'Camera', tone: 'neutral', icon: 'video-off' } };
