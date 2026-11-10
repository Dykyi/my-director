import type { ReactNode } from 'react';
import { View } from 'react-native';

export function RoomCard({ children }: { children: ReactNode }) {
  return (
    <View className="gap-2.5 rounded-md border border-border border-continuous bg-surface px-3.5 py-3">
      {children}
    </View>
  );
}
