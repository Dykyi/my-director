import { cva } from 'class-variance-authority';
import { Pressable, View } from 'react-native';

import { cn } from '@ui/cn';
import { Icon } from '@ui/icon';
import { StatusDot } from '@ui/status-dot';
import { Text } from '@ui/text';

import type { HealthLineView } from '../session-issues';

const row = cva('h-11 flex-row items-center gap-2 border-t px-4', {
  variants: {
    tone: {
      ok: 'border-border active:opacity-70',
      quiet: 'border-border',
      warning: 'border-warning-line bg-warning-soft active:opacity-70',
      error: 'border-danger-line bg-danger-soft active:opacity-70',
    },
  },
});

const ISSUE = {
  warning: {
    text: 'text-warning',
    detail: 'text-on-warning-soft',
    icon: 'warning',
    tint: 'accent-warning',
  },
  error: {
    text: 'text-danger',
    detail: 'text-on-recording-soft',
    icon: 'alert-octagon',
    tint: 'accent-danger',
  },
} as const;

export function HealthLine({ view, onPress }: { view: HealthLineView; onPress: () => void }) {
  if (view.tone === 'quiet') {
    return (
      <View className={row({ tone: 'quiet' })}>
        <StatusDot tone="idle" />
        <Text variant="footnote" className="text-subtle">
          {view.text}
        </Text>
      </View>
    );
  }
  if (view.tone === 'ok') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens Debug"
        onPress={onPress}
        className={row({ tone: 'ok' })}
      >
        <StatusDot tone="live" />
        <Text variant="footnote" className="text-subtle">
          {view.text}
        </Text>
        <Text variant="footnote" className="ml-auto text-muted">
          Debug ›
        </Text>
      </Pressable>
    );
  }
  const issue = ISSUE[view.tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens Debug"
      onPress={onPress}
      className={row({ tone: view.tone })}
    >
      <Icon name={issue.icon} className="size-3.5" tint={issue.tint} />
      <Text numberOfLines={1} variant="footnote-strong" className={cn('shrink', issue.text)}>
        {view.text}
      </Text>
      {view.detail !== undefined && (
        <Text numberOfLines={1} variant="footnote" className={issue.detail}>
          {view.detail}
        </Text>
      )}
      <Text variant="footnote-strong" className={cn('ml-auto', issue.text)}>
        Debug ›
      </Text>
    </Pressable>
  );
}
