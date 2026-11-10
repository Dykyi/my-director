import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from './text';

export function Dialog({ children }: { children: ReactNode }) {
  return (
    <View className="flex-1 justify-center bg-scrim px-4">
      <View
        accessibilityViewIsModal
        className="gap-3.5 rounded-xl border border-border-strong border-continuous bg-surface p-4.5"
      >
        {children}
      </View>
    </View>
  );
}

export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-0.5 rounded-sm border-continuous bg-background p-2.5">
      <Text variant="stat-label" className="text-muted">
        {label}
      </Text>
      <Text
        selectable
        numberOfLines={1}
        adjustsFontSizeToFit
        variant="stat"
        className="text-foreground"
      >
        {value}
      </Text>
    </View>
  );
}
