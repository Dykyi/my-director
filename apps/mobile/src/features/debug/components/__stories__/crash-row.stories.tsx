import type { Meta, StoryObj } from '@storybook/react-native';

import { CrashRow } from '../crash-row';

const meta = {
  title: 'Features/Debug/CrashRow',
  component: CrashRow,
  args: { onCrash: () => {} },
  parameters: { inset: 'none' },
} satisfies Meta<typeof CrashRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
