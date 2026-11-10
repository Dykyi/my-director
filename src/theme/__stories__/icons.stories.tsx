import type { Meta, StoryObj } from '@storybook/react-native';
import { ScrollView, View } from 'react-native';

import { tintControl } from '@test/story-controls';
import { Icon } from '@ui/icon';
import { FILLED_ICONS, ICONS, type IconName } from '@ui/icons';
import { Text } from '@ui/text';

function Icons({ size, tint }: { size: string; tint: string }) {
  const names = Object.keys(ICONS) as IconName[];
  return (
    <ScrollView contentContainerClassName="flex-row flex-wrap gap-y-4 pb-16">
      {names.map((name) => (
        <View key={name} className="w-1/4 items-center gap-1.5">
          <Icon name={name} className={size} tint={tint} />
          <Text variant="caption" className="text-center text-muted">
            {FILLED_ICONS.has(name) ? `${name} ●` : name}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const meta = {
  title: 'Branding/Icons',
  component: Icons,
  args: { size: 'size-6', tint: 'accent-foreground' },
  argTypes: {
    size: { control: { type: 'select' }, options: ['size-4', 'size-5', 'size-6', 'size-8'] },
    tint: tintControl,
  },
} satisfies Meta<typeof Icons>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllIcons: Story = {};
