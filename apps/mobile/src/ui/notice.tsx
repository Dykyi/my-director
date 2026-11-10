import { cva } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Icon } from './icon';
import { Text } from './text';
import { TextButton } from './text-button';

export function ErrorNotice({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children: ReactNode;
}) {
  return (
    <View
      accessibilityRole="alert"
      className="gap-2 rounded-sm border border-danger-line border-continuous bg-danger-soft p-3"
    >
      <View className="flex-row gap-2">
        <Icon name="alert-circle" className="size-4" tint="accent-danger" />
        <View className="flex-1 gap-0.5">
          <Text selectable variant="alert-title" className="text-on-recording-soft">
            {title}
          </Text>
          <Text selectable variant="footnote" className="text-on-recording-soft">
            {message}
          </Text>
        </View>
      </View>
      <View className="flex-row justify-end gap-2">{children}</View>
    </View>
  );
}

const warningText = cva('flex-1', {
  variants: { locked: { true: 'text-warning', false: 'text-on-warning-soft' } },
});

export function WarningNotice({
  message,
  locked = false,
  link,
}: {
  message: string;
  locked?: boolean;
  link?: { title: string; onPress: () => void };
}) {
  return (
    <View className="flex-row items-center gap-2 rounded-sm border border-warning-line border-continuous bg-warning-soft px-3 py-2.5">
      <Icon name={locked ? 'lock' : 'warning'} className="size-3.5" tint="accent-warning" />
      <Text variant={locked ? 'callout' : 'footnote'} className={warningText({ locked })}>
        {message}
      </Text>
      {link && <TextButton title={`${link.title} ›`} onPress={link.onPress} tone="warning" />}
    </View>
  );
}
