import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { CloseButton } from './icon-button';
import { Text } from './text';

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <View className="flex-1 border-t border-border bg-background">
      <View
        accessibilityElementsHidden
        className="mt-1.5 h-1.25 w-9 self-center rounded-pill bg-border-strong"
      />
      <View className="flex-row items-center gap-2.5 px-4 pb-3 pt-1.5">
        <View className="flex-1 gap-0.5">
          <Text accessibilityRole="header" variant="title" className="text-foreground">
            {title}
          </Text>
          {subtitle !== undefined && (
            <Text selectable variant="mono-meta" className="text-muted">
              {subtitle}
            </Text>
          )}
        </View>
        <CloseButton onPress={onClose} />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-4"
        contentInsetAdjustmentBehavior="automatic"
      >
        {children}
      </ScrollView>
    </View>
  );
}
