import { View } from 'react-native';

import { Text } from './text';

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
