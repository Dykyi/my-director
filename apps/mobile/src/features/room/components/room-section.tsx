import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@ui/text';

export function RoomSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text variant="section-label" className="px-1 text-muted">
        {title}
      </Text>
      {children}
    </View>
  );
}
