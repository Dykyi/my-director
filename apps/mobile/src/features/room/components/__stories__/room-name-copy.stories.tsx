import type { Meta, StoryObj } from '@storybook/react-native';

import { RoomNameCopy } from '../room-name-copy';

const meta = {
  title: 'Features/Room/RoomNameCopy',
  component: RoomNameCopy,
  args: { room: 'mydirector-poc' },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof RoomNameCopy>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
