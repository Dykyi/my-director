import type { Meta, StoryObj } from '@storybook/react-native';

import { CopyButton } from '../copy-button';

const meta = {
  title: 'UI/Controls/CopyButton',
  component: CopyButton,
  args: { value: '2026-11-10T10-28-29Z-8F2B/segment-001.mov', label: 'object key' },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof CopyButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ObjectKey: Story = {};
