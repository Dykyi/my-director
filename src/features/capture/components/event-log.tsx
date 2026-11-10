import { ScrollView, Text } from 'react-native';

import type { LogEntry, LogLevel } from '@modules/capture-core';

import { formatLogLine } from '../format';
import { colors, gutter, mono } from './theme';

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: colors.muted,
  info: colors.secondary,
  warning: colors.pausedText,
  error: colors.recordingText,
};

export function EventLog({ entries }: { entries: LogEntry[] }) {
  return (
    <ScrollView
      accessibilityLabel="Event log"
      style={{ flexGrow: 1, flexShrink: 1, flexBasis: 60 }}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 8, gap: 3 }}
    >
      {entries.map((entry) => (
        <Text
          key={`${entry.mono}-${entry.category}-${entry.message}`}
          selectable
          style={[mono, { fontSize: 11, color: LEVEL_COLOR[entry.level] }]}
        >
          {formatLogLine(entry)}
        </Text>
      ))}
    </ScrollView>
  );
}
