import type { Meta, StoryObj } from '@storybook/react-native';
import { ScrollView, View } from 'react-native';

import { Text } from '@ui/text';

import { THEME_COLORS, type ColorRole } from '../colors';
import { PARTICIPANT_COLORS } from '../scales';
import { useThemeName } from '../use-theme-colors';

function Swatch({ name, color }: { name: string; color: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="size-9 rounded-sm border border-border" style={{ backgroundColor: color }} />
      <View className="flex-1">
        <Text variant="row-title" className="text-foreground">
          {name}
        </Text>
        <Text selectable variant="mono-value" className="text-muted">
          {color}
        </Text>
      </View>
    </View>
  );
}

function Colors() {
  const theme = useThemeName();
  const roles = Object.entries(THEME_COLORS[theme]) as [ColorRole, string][];
  return (
    <ScrollView contentContainerClassName="gap-2.5 pb-16">
      <Text variant="section-label" className="text-muted">
        {theme.toUpperCase()} THEME · {roles.length} ROLES
      </Text>
      {roles.map(([role, color]) => (
        <Swatch key={role} name={role} color={color} />
      ))}
      <Text variant="section-label" className="pt-3 text-muted">
        PARTICIPANTS
      </Text>
      {PARTICIPANT_COLORS[theme].map(({ text, ground }, index) => (
        <View key={text} className="flex-row gap-3">
          <Swatch name={`participant ${index + 1} text`} color={text} />
          <Swatch name="ground" color={ground} />
        </View>
      ))}
    </ScrollView>
  );
}

const meta = {
  title: 'Branding/Colors',
  component: Colors,
} satisfies Meta<typeof Colors>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllRoles: Story = {};
