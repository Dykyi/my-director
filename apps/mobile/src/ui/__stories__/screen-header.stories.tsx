import type { Meta, StoryObj } from '@storybook/react-native';

import { ScreenHeader } from '../screen-header';

const meta = {
  title: 'UI/Containers/ScreenHeader',
  component: ScreenHeader,
  args: { title: 'Recordings', fact: '3 sessions · 41.2 GB free', caption: '', compact: false },
  parameters: { inset: 'none' },
} satisfies Meta<typeof ScreenHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithFact: Story = {};
export const Compact: Story = {
  args: { title: 'Debug', fact: 'updates every second', compact: true },
};
export const WithCaption: Story = {
  args: {
    title: 'Settings',
    fact: '',
    caption: 'What this build records with. You can switch the camera here.',
  },
};
