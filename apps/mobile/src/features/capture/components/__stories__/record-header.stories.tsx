import type { Meta, StoryObj } from '@storybook/react-native';

import type { SessionPhase } from '@modules/capture-core';

import { selectOf } from '@test/story-controls';

import { PHASE_PILL } from '../../session-labels';
import { RecordHeader } from '../record-header';

function RecordHeaderStory({
  phase,
  time,
  fact,
}: {
  phase: SessionPhase;
  time: string;
  fact: string;
}) {
  return (
    <RecordHeader pill={PHASE_PILL[phase]} time={time} live={phase === 'recording'} fact={fact} />
  );
}

const meta = {
  title: 'Features/Record/RecordHeader',
  component: RecordHeaderStory,
  args: { phase: 'ready', time: '00:00', fact: '41.2 GB free · about 16 h' },
  argTypes: { phase: selectOf(PHASE_PILL) },
  parameters: { inset: 'none' },
} satisfies Meta<typeof RecordHeaderStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Recording: Story = {
  args: { phase: 'recording', time: '05:12', fact: 'seg 2 · 212.0 MB' },
};
export const Paused: Story = { args: { phase: 'paused', time: '05:12', fact: 'seg 2 saved' } };
