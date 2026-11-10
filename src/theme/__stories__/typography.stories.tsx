import type { Meta, StoryObj } from '@storybook/react-native';
import { ScrollView, View, type TextStyle } from 'react-native';

import { Text } from '@ui/text';

import { TYPE_STYLES, type TypeStyle } from '../type-styles';

function spec({ fontFamily, fontSize, lineHeight, letterSpacing }: TextStyle): string {
  const tracking = letterSpacing ? ` +${letterSpacing}` : '';
  return `${fontFamily} ${fontSize}/${lineHeight}${tracking}`;
}

function Typography({ sample }: { sample: string }) {
  const variants = Object.entries(TYPE_STYLES) as [TypeStyle, TextStyle][];
  return (
    <ScrollView contentContainerClassName="gap-3.5 pb-16">
      {variants.map(([variant, style]) => (
        <View key={variant} className="gap-0.5">
          <Text variant="caption" className="text-muted">
            {variant} · {spec(style)}
          </Text>
          <Text variant={variant} className="text-foreground">
            {sample}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const meta = {
  title: 'Branding/Typography',
  component: Typography,
  args: { sample: 'Segment 2 · 05:12 · 238 MB' },
} satisfies Meta<typeof Typography>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllStyles: Story = {};
