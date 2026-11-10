import type { Meta, StoryObj } from '@storybook/react-native';

import { RemoteStatus } from '../remote-status';

function RemoteStatusStory({ command }: { command: string }) {
  return (
    <RemoteStatus
      lastCommand={command ? { name: command, at: '2026-11-10T09:12:33.000Z' } : undefined}
    />
  );
}

const meta = {
  title: 'Features/Debug/RemoteStatus',
  component: RemoteStatusStory,
  args: { command: '' },
  parameters: { inset: 'none' },
} satisfies Meta<typeof RemoteStatusStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoCommand: Story = {};
export const LastCommand: Story = { args: { command: 'start' } };
