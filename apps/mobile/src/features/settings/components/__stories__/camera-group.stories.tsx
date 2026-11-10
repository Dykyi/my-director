import type { Meta, StoryObj } from '@storybook/react-native';

import { sampleAbout, sampleCallTarget, sampleConfig } from '@test/settings-fixtures';

import { settingsGroups } from '../../settings-rows';
import { CameraGroup } from '../camera-group';

function CameraGroupStory({ locked }: { locked: boolean }) {
  const [camera] = settingsGroups(sampleConfig, sampleAbout, sampleCallTarget);
  if (!camera) return null;
  return (
    <CameraGroup
      group={camera}
      position={sampleConfig.camera.position}
      locked={locked}
      onChange={() => {}}
    />
  );
}

const meta = {
  title: 'Features/Settings/CameraGroup',
  component: CameraGroupStory,
  args: { locked: false },
} satisfies Meta<typeof CameraGroupStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Editable: Story = {};
export const LockedWhileRecording: Story = { args: { locked: true } };
