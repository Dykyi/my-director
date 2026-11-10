import { View } from 'react-native';

import { StatusPill, type PillTone } from '@ui/status-pill';
import { Text } from '@ui/text';

export function RecordHeader({
  pill,
  time,
  live,
  fact,
}: {
  pill: { label: string; tone: PillTone };
  time: string;
  live: boolean;
  fact: string;
}) {
  return (
    <View className="flex-row items-center gap-2.5 border-b border-border px-4 pb-3 pt-3.5">
      <StatusPill label={pill.label} tone={pill.tone} />
      <Text selectable variant="timer" className={live ? 'text-foreground' : 'text-muted'}>
        {time}
      </Text>
      <Text selectable numberOfLines={1} variant="footnote" className="ml-auto shrink text-muted">
        {fact}
      </Text>
    </View>
  );
}
