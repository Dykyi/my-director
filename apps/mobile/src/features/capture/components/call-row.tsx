import { Pressable, View } from 'react-native';

import { Chip } from '@ui/chip';
import { Icon } from '@ui/icon';
import { QualityChip } from '@ui/quality-chip';
import { Text } from '@ui/text';

import type { CallRowView } from '../record-views';

export function CallRow({ view, onPress }: { view: CallRowView; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the room"
      onPress={onPress}
      className="h-14 flex-row items-center gap-3 border-b border-border px-4 active:opacity-70"
    >
      <Icon
        name="users"
        className="size-5.5"
        tint={view.inCall ? 'accent-accent' : 'accent-muted'}
      />
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1} variant="row-title" className="text-foreground">
          {view.title}
        </Text>
        <Text numberOfLines={1} variant="caption" className="text-muted">
          {view.detail}
        </Text>
      </View>
      {'lit' in view.chip ? (
        <QualityChip {...view.chip} className="self-center" />
      ) : (
        <Chip label={view.chip.label} tone={view.chip.tone} className="self-center" />
      )}
      <Icon name="chevron-right" className="size-3.5" tint="accent-faint" />
    </Pressable>
  );
}
