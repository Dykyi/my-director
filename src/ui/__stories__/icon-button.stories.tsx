import type { Meta, StoryObj } from '@storybook/react-native';

import { iconControl } from '@test/story-controls';

import { CloseButton, IconButton } from '../icon-button';

const meta = {
  title: 'UI/Controls/IconButton',
  component: IconButton,
  args: { icon: 'camera', label: 'Switch camera', disabled: false, onPress: () => {} },
  argTypes: { icon: iconControl },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const Close: Story = { render: (args) => <CloseButton onPress={args.onPress} /> };
