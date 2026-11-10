import type { Meta, StoryObj } from '@storybook/react-native';

import type { SessionPhase } from '@modules/capture-core';

import { noopActions, recordingSnapshot } from '@test/session-fixtures';
import { rangeOf, selectOf } from '@test/story-controls';

import { PHASE_PILL } from '../../session-labels';
import { Controls } from '../controls';

function ControlsStory({
  phase,
  segmentIndex,
  accessReady,
}: {
  phase: SessionPhase;
  segmentIndex: number;
  accessReady: boolean;
}) {
  return (
    <Controls
      snapshot={{ ...recordingSnapshot, phase, segmentIndex }}
      actions={noopActions}
      accessReady={accessReady}
    />
  );
}

const meta = {
  title: 'Features/Record/Controls',
  component: ControlsStory,
  args: { phase: 'ready', segmentIndex: 2, accessReady: true },
  argTypes: { phase: selectOf(PHASE_PILL), segmentIndex: rangeOf(1, 9) },
  parameters: { inset: 'none' },
} satisfies Meta<typeof ControlsStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Recording: Story = { args: { phase: 'recording' } };
export const Paused: Story = { args: { phase: 'paused' } };
export const Busy: Story = { args: { phase: 'stopping' } };
export const WaitingForAccess: Story = { args: { phase: 'idle', accessReady: false } };
