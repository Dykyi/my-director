import type { Meta, StoryObj } from '@storybook/react-native';

import { StatTile } from '../stat-tile';

const meta = {
  title: 'UI/Feedback/StatTile',
  component: StatTile,
  args: { label: 'Recovered', value: '4:12' },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof StatTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LongValue: Story = { args: { label: 'Lost', value: '12.4 to 14.9 s' } };
