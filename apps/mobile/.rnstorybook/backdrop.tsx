import type { Decorator } from '@storybook/react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { appearance } from '@theme/appearance';
import { useThemeName } from '@theme/use-theme-colors';
import { Icon } from '@ui/icon';

type BackdropKind = 'screen' | 'sheet';
type StoryInset = 'padded' | 'centered' | 'none';

const INSET_CLASS: Record<StoryInset, string> = {
  padded: 'flex-1 p-4',
  centered: 'flex-1 items-center justify-center p-4',
  none: 'flex-1',
};

function ThemeSwitch() {
  const theme = useThemeName();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Toggle theme"
      onPress={() => appearance.set(theme === 'dark' ? 'light' : 'dark')}
      className="absolute bottom-3 left-3 z-10 size-9 items-center justify-center rounded-pill border border-border bg-surface"
    >
      <Icon name="contrast" className="size-4.5" tint="accent-foreground" />
    </Pressable>
  );
}

function Ground({ kind, children }: { kind: BackdropKind; children: ReactNode }) {
  if (kind === 'sheet') {
    return (
      <View className="flex-1 bg-backdrop pt-12">
        <View className="flex-1 rounded-t-lg border-t border-border bg-background">{children}</View>
      </View>
    );
  }
  return <View className="flex-1 bg-background">{children}</View>;
}

export const withBackdrop: Decorator = (Story, context) => {
  const kind: BackdropKind = context.parameters.backdrop ?? 'screen';
  // Not `layout`: Storybook owns that name and its padding would frame the canvas.
  const inset: StoryInset = context.parameters.inset ?? 'padded';
  return (
    <View className="flex-1">
      <Ground kind={kind}>
        <View className={INSET_CLASS[inset]}>
          <Story />
        </View>
      </Ground>
      <ThemeSwitch />
    </View>
  );
};
