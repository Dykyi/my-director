import type { Meta, StoryObj } from '@storybook/react-native';

import { selectOf } from '@test/story-controls';

import { StatusDot, type DotTone } from '../status-dot';

const meta = {
  title: 'UI/Status/StatusDot',
  component: StatusDot,
  args: { tone: 'idle' },
  argTypes: { tone: selectOf<DotTone>({ idle: true, live: true, recording: true }) },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof StatusDot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {};
export const Live: Story = { args: { tone: 'live' } };
export const Recording: Story = { args: { tone: 'recording' } };
