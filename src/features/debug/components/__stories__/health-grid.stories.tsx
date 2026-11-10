import type { Meta, StoryObj } from '@storybook/react-native';

import type { SessionPhase, ThermalLevel } from '@modules/capture-core';

import { PHASE_PILL } from '@features/capture/session-labels';
import { recordingSnapshot, sampleHealth } from '@test/session-fixtures';
import { rangeOf, selectOf } from '@test/story-controls';

import { HealthGrid } from '../health-grid';

function HealthGridStory({
  phase,
  hasHealth,
  cameraFps,
  fileFps,
  levelDb,
  thermal,
  input,
}: {
  phase: SessionPhase;
  hasHealth: boolean;
  cameraFps: number;
  fileFps: number;
  levelDb: number;
  thermal: ThermalLevel;
  input: string;
}) {
  const health = sampleHealth();
  return (
    <HealthGrid
      snapshot={{ ...recordingSnapshot, phase }}
      health={
        hasHealth
          ? {
              ...health,
              camera: { ...health.camera, fps: cameraFps },
              file: { ...health.file, fps: fileFps },
              audio: { ...health.audio, levelDb },
              thermal,
              audioRoute: { ...health.audioRoute, input },
            }
          : null
      }
    />
  );
}

const meta = {
  title: 'Features/Debug/HealthGrid',
  component: HealthGridStory,
  args: {
    phase: 'recording',
    hasHealth: true,
    cameraFps: 30,
    fileFps: 29.97,
    levelDb: -18,
    thermal: 'nominal',
    input: 'AirPods Pro (BluetoothHFP)',
  },
  argTypes: {
    phase: selectOf(PHASE_PILL),
    cameraFps: rangeOf(0, 30),
    fileFps: rangeOf(0, 30, 0.01),
    levelDb: rangeOf(-120, 0),
    thermal: selectOf<ThermalLevel>({ nominal: true, fair: true, serious: true, critical: true }),
  },
  parameters: { inset: 'none' },
} satisfies Meta<typeof HealthGridStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Recording: Story = {};
export const Ready: Story = { args: { phase: 'ready', fileFps: 0 } };
export const Hot: Story = { args: { thermal: 'serious', cameraFps: 24 } };
export const NoHealthYet: Story = { args: { phase: 'ready', hasHealth: false } };
