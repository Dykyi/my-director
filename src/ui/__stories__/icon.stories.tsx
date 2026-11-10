import type { Meta, StoryObj } from '@storybook/react-native';

import { iconControl, tintControl } from '@test/story-controls';

import { Icon } from '../icon';

const meta = {
  title: 'UI/Type/Icon',
  component: Icon,
  args: { name: 'ring', className: 'size-6', tint: 'accent-foreground' },
  argTypes: { name: iconControl, tint: tintControl },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ring: Story = {};
export const RecordDot: Story = { args: { name: 'dot', tint: 'accent-record' } };
export const Warning: Story = {
  args: { name: 'warning', className: 'size-4', tint: 'accent-warning' },
};
