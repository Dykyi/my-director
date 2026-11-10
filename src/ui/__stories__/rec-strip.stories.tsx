import type { Meta, StoryObj } from '@storybook/react-native';

import { selectOf } from '@test/story-controls';

import { RecStrip, type StripTone } from '../rec-strip';

const meta = {
  title: 'UI/Navigation/RecStrip',
  component: RecStrip,
  args: { tone: 'recording', label: 'REC', time: '05:12', detail: '· seg 2', onPress: () => {} },
  argTypes: { tone: selectOf<StripTone>({ recording: true, paused: true }) },
  parameters: { inset: 'none' },
} satisfies Meta<typeof RecStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Recording: Story = {};
export const Paused: Story = { args: { tone: 'paused', label: 'PAUSED', detail: '· seg 2 saved' } };
