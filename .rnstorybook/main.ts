import type { StorybookConfig } from '@storybook/react-native';

const main: StorybookConfig = {
  stories: [
    '../src/theme/__stories__/*.stories.tsx',
    '../src/ui/**/__stories__/*.stories.tsx',
    '../src/features/**/__stories__/*.stories.tsx',
  ],
  deviceAddons: ['@storybook/addon-ondevice-controls', '@storybook/addon-ondevice-actions'],
};

export default main;
