import type { Meta, StoryObj } from '@storybook/react-native';

import { NothingToPlay } from '../nothing-to-play';

const meta = {
  title: 'Features/Recordings/NothingToPlay',
  component: NothingToPlay,
  args: { onClose: () => {} },
  parameters: { inset: 'none' },
} satisfies Meta<typeof NothingToPlay>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
