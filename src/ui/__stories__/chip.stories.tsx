import type { Meta, StoryObj } from '@storybook/react-native';

import { iconControl, selectOf } from '@test/story-controls';

import { Chip, type ChipKind } from '../chip';
import type { ChipTone } from '../tone';

const meta = {
  title: 'UI/Status/Chip',
  component: Chip,
  args: { label: 'finished', tone: 'success', kind: 'state', icon: undefined },
  argTypes: {
    kind: selectOf<ChipKind>({ state: true, count: true, track: true }),
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
} satisfies Meta<typeof Chip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const State: Story = {};
export const Uploading: Story = { args: { label: 'uploading', tone: 'accent' } };
export const Count: Story = { args: { label: '3', tone: 'danger', kind: 'count' } };
export const Speaking: Story = {
  args: { label: 'speaking', tone: 'accent', kind: 'track', icon: 'mic' },
};
