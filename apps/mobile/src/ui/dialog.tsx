import type { ReactNode } from 'react';
import { View } from 'react-native';

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
