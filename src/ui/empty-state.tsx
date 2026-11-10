import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Icon } from './icon';
import type { IconName } from './icons';
import { Text } from './text';

export function EmptyState({
  icon,
  title,
  text,
  children,
}: {
  icon: IconName;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <View className="items-center gap-2.5 rounded-md border border-dashed border-border-strong border-continuous px-5 py-6">
      <Icon name={icon} className="size-10" tint="accent-faint" />
      <Text variant="overlay-title" className="text-center text-foreground">
        {title}
      </Text>
      <Text variant="callout" className="text-center text-subtle">
        {text}
      </Text>
      {children}
    </View>
  );
}
