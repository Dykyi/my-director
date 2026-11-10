import type { Meta, StoryObj } from '@storybook/react-native';

import { TextButton } from '../text-button';

const meta = {
  title: 'UI/Controls/TextButton',
  component: TextButton,
  args: {
    title: 'Reset camera to defaults',
    disabled: false,
    compact: false,
    tone: 'accent',
    onPress: () => {},
  },
  argTypes: {
    tone: { control: { type: 'select' }, options: ['accent', 'warning'] },
  },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof TextButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const InBanner: Story = {
  args: { title: 'Record ›', tone: 'warning', compact: true },
};
export const Disabled: Story = { args: { disabled: true } };
