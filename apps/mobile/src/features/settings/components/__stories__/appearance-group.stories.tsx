import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';

import type { ThemePreference } from '@theme/appearance';

import { AppearanceGroup } from '../appearance-group';

function AppearanceGroupStory() {
  const [theme, setTheme] = useState<ThemePreference>('system');
  return <AppearanceGroup theme={theme} onChange={setTheme} />;
}

const meta = {
  title: 'Features/Settings/AppearanceGroup',
  component: AppearanceGroupStory,
} satisfies Meta<typeof AppearanceGroupStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
