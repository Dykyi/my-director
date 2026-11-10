import type { Meta, StoryObj } from '@storybook/react-native';

import type { CallQuality } from '@modules/capture-core';

import { selectOf } from '@test/story-controls';

import { QUALITY_LOOK } from '../../call-labels';
import { CallChip } from '../call-chip';

function CallChipStory({ joined, quality }: { joined: boolean; quality: CallQuality }) {
  return (
    <CallChip chip={joined ? QUALITY_LOOK[quality] : { label: 'not joined', tone: 'neutral' }} />
  );
}

const meta = {
  title: 'Features/Record/CallChip',
  component: CallChipStory,
  args: { joined: true, quality: 'excellent' },
  argTypes: { quality: selectOf(QUALITY_LOOK) },
} satisfies Meta<typeof CallChipStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Quality: Story = {};
export const NotJoined: Story = { args: { joined: false } };
