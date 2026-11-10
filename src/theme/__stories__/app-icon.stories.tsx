import type { Meta, StoryObj } from '@storybook/react-native';
import { ScrollView, View } from 'react-native';

import lightIcon from '@assets/icon.png';
import darkIcon from '@assets/ios-dark.png';
import tintedIcon from '@assets/ios-tinted.png';
import Logo from '@assets/logo.svg';
import splash from '@assets/splash-icon.png';
import { Image } from '@ui/styled';
import { Text } from '@ui/text';

const APP_ICONS = [
  { label: 'iOS light', source: lightIcon },
  { label: 'iOS dark', source: darkIcon },
  { label: 'iOS tinted', source: tintedIcon },
  { label: 'Splash', source: splash },
];

function AppIcon() {
  return (
    <ScrollView contentContainerClassName="gap-5 pb-16">
      <View className="items-center gap-2">
        <Logo width={96} height={96} />
        <Text variant="caption" className="text-muted">
          assets/logo.svg
        </Text>
      </View>
      <View className="flex-row flex-wrap justify-between gap-y-4">
        {APP_ICONS.map(({ label, source }) => (
          <View key={label} className="w-[48%] items-center gap-2">
            <Image source={source} className="size-28 rounded-3xl" />
            <Text variant="caption" className="text-muted">
              {label}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const meta = {
  title: 'Branding/App icon',
  component: AppIcon,
} satisfies Meta<typeof AppIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LogoAndIcons: Story = {};
