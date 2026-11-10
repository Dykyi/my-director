import type { Meta, StoryObj } from '@storybook/react-native';

import type { PauseReason, SessionPhase } from '@modules/capture-core';

import { accessCard } from '@features/access/access-card-view';
import { AccessCard } from '@features/access/components/access-card';
import { recordingSnapshot, sampleCamera, sampleHealth } from '@test/session-fixtures';
import { rangeOf, selectOf } from '@test/story-controls';

import { PAUSE_REASON, PHASE_PILL } from '../../session-labels';
import { PreviewPanel } from '../preview-panel';

const FIRST_LAUNCH = accessCard({ camera: 'undetermined', microphone: 'undetermined' }, undefined);

function PreviewPanelStory({
  phase,
  waitingForAccess,
  pauseReason,
  levelDb,
}: {
  phase: SessionPhase;
  waitingForAccess: boolean;
  pauseReason: PauseReason;
  levelDb: number;
}) {
  const health = sampleHealth();
  return (
    <PreviewPanel
      snapshot={{ ...recordingSnapshot, phase, pauseReason }}
      health={{ ...health, audio: { ...health.audio, levelDb } }}
      camera={sampleCamera}
      accessCard={
        waitingForAccess && FIRST_LAUNCH && <AccessCard card={FIRST_LAUNCH} onAction={() => {}} />
      }
    />
  );
}

const meta = {
  title: 'Features/Record/PreviewPanel',
  component: PreviewPanelStory,
  args: {
    phase: 'idle',
    waitingForAccess: true,
    pauseReason: 'phoneCall',
    levelDb: -18,
  },
  argTypes: {
    phase: selectOf(PHASE_PILL),
    pauseReason: selectOf(PAUSE_REASON),
    levelDb: rangeOf(-60, 0),
  },
  parameters: { inset: 'none' },
} satisfies Meta<typeof PreviewPanelStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WaitingForAccess: Story = {};
export const Starting: Story = { args: { phase: 'preparing', waitingForAccess: false } };
export const PausedForCall: Story = { args: { phase: 'paused', waitingForAccess: false } };
