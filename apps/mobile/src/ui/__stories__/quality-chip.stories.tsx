import type { Meta, StoryObj } from '@storybook/react-native';

import { rangeOf, selectOf } from '@test/story-controls';

import { QualityChip } from '../quality-chip';
import type { ChipTone } from '../tone';

const meta = {
  title: 'UI/Status/QualityChip',
  component: QualityChip,
  args: { label: 'excellent', tone: 'success', lit: 3 },
  argTypes: {
    tone: selectOf<ChipTone>({
      neutral: true,
      recording: true,
      paused: true,
      accent: true,
      success: true,
      danger: true,
    }),
    lit: rangeOf(0, 3),
  },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof QualityChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Excellent: Story = {};
export const Good: Story = { args: { label: 'good', tone: 'success', lit: 2 } };
export const Poor: Story = { args: { label: 'poor', tone: 'paused', lit: 1 } };
export const Lost: Story = { args: { label: 'lost', tone: 'danger', lit: 0 } };
