import type { Meta, StoryObj } from '@storybook/react-native';

import { CopyButton } from '../copy-button';

const meta = {
  title: 'UI/Controls/CopyButton',
  component: CopyButton,
  args: { copy: async () => true, label: 'download link' },
  parameters: { inset: 'centered' },
} satisfies Meta<typeof CopyButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DownloadLink: Story = {};
