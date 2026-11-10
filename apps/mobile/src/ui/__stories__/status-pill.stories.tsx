import type { Meta, StoryObj } from '@storybook/react-native';

import { selectOf } from '@test/story-controls';

import { StatusPill, type PillTone } from '../status-pill';

const meta = {
  title: 'UI/Status/StatusPill',
  component: StatusPill,
  args: { label: 'READY', tone: 'neutral' },
  argTypes: { tone: selectOf<PillTone>({ neutral: true, recording: true, paused: true }) },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof StatusPill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Recording: Story = { args: { label: 'RECORDING', tone: 'recording' } };
export const Paused: Story = { args: { label: 'PAUSED', tone: 'paused' } };
