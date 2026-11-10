import type { Meta, StoryObj } from '@storybook/react-native';

import type { PauseReason, PermissionStatus, SessionPhase } from '@modules/capture-core';

import { recordingSnapshot, sampleCamera, sampleHealth } from '@test/session-fixtures';
import { rangeOf, selectOf } from '@test/story-controls';

import { PAUSE_REASON, PHASE_PILL } from '../../session-labels';
import { PreviewPanel } from '../preview-panel';

const PERMISSION = selectOf<PermissionStatus>({ granted: true, denied: true, undetermined: true });

function PreviewPanelStory({
  phase,
  camera,
  microphone,
  pauseReason,
  levelDb,
}: {
  phase: SessionPhase;
  camera: PermissionStatus;
  microphone: PermissionStatus;
  pauseReason: PauseReason;
  levelDb: number;
}) {
  const health = sampleHealth();
  return (
    <PreviewPanel
      snapshot={{ ...recordingSnapshot, phase, pauseReason }}
      health={{ ...health, audio: { ...health.audio, levelDb } }}
      permissions={{ camera, microphone }}
      camera={sampleCamera}
      onRequestPermissions={() => {}}
    />
  );
}

const meta = {
  title: 'Features/Record/PreviewPanel',
  component: PreviewPanelStory,
  args: {
    phase: 'idle',
    camera: 'undetermined',
    microphone: 'undetermined',
    pauseReason: 'phoneCall',
    levelDb: -18,
  },
  argTypes: {
    phase: selectOf(PHASE_PILL),
    camera: PERMISSION,
    microphone: PERMISSION,
    pauseReason: selectOf(PAUSE_REASON),
    levelDb: rangeOf(-60, 0),
  },
  parameters: { inset: 'none' },
} satisfies Meta<typeof PreviewPanelStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoPermission: Story = {};
export const Denied: Story = { args: { camera: 'denied', microphone: 'granted' } };
export const Starting: Story = {
  args: { phase: 'preparing', camera: 'granted', microphone: 'granted' },
};
export const PausedForCall: Story = {
  args: { phase: 'paused', camera: 'granted', microphone: 'granted' },
};
