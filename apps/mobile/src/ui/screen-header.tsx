import { cva, type VariantProps } from 'class-variance-authority';
import { View } from 'react-native';

import { Text } from './text';

const titleRow = cva('flex-row items-center gap-2.5 border-b border-border px-4', {
  variants: { compact: { true: 'h-12', false: 'h-13' } },
  defaultVariants: { compact: false },
});

export function ScreenHeader({
  title,
  fact,
  caption,
  compact,
}: VariantProps<typeof titleRow> & {
  title: string;
  fact?: string;
  caption?: string;
}) {
  if (caption !== undefined) {
    return (
      <View className="gap-1 border-b border-border px-4 pb-3 pt-3.5">
        <Text accessibilityRole="header" variant="title" className="text-foreground">
          {title}
        </Text>
        <Text variant="footnote" className="text-muted">
          {caption}
        </Text>
      </View>
    );
  }
  return (
    <View className={titleRow({ compact })}>
      <Text accessibilityRole="header" variant="title" className="text-foreground">
        {title}
      </Text>
      {fact !== undefined && (
        <Text selectable variant="footnote" className="ml-auto text-muted">
          {fact}
        </Text>
      )}
    </View>
  );
}
