import { cva } from 'class-variance-authority';
import { ScrollView, Share, View } from 'react-native';

import type { LogEntry } from '@modules/capture-core';

import { formatLogLine, plural } from '@shared/format';
import { Chip } from '@ui/chip';
import { cn } from '@ui/cn';
import type { TabBadge } from '@ui/tab-bar';
import { Text } from '@ui/text';
import { TextButton } from '@ui/text-button';

import { logLines } from '../log-lines';

const line = cva('', {
  variants: {
    level: {
      debug: 'text-muted',
      info: 'text-subtle',
      warning: 'text-warning',
      error: 'text-danger',
    },
  },
});

const BADGE_TONE = { warning: 'paused', error: 'danger' } as const;

function LogLine({ entry }: { entry: LogEntry }) {
  const { head, details } = logLines(entry);
  return (
    <View>
      <Text selectable variant="log" className={line({ level: entry.level })}>
        {head}
      </Text>
      {details.map((detail) => (
        <Text
          key={detail}
          selectable
          variant="log"
          className={cn('pl-16', line({ level: entry.level }))}
        >
          {detail}
        </Text>
      ))}
    </View>
  );
}

export function EventLog({ entries, badge }: { entries: LogEntry[]; badge?: TabBadge }) {
  const share = () => void Share.share({ message: entries.map(formatLogLine).join('\n') });
  return (
    <View className="flex-1">
      <View className="h-8.5 flex-row items-center gap-2 px-4">
        <Text variant="footnote-strong" className="text-foreground">
          Event log
        </Text>
        {badge && (
          <Chip
            kind="count"
            label={plural(badge.count, badge.severity)}
            tone={BADGE_TONE[badge.severity]}
            className="self-center"
          />
        )}
        <View className="ml-auto">
          <TextButton compact title="Share log" onPress={share} />
        </View>
      </View>
      <ScrollView
        accessibilityLabel="Event log"
        className="flex-1"
        contentContainerClassName="gap-0.75 px-4 pb-2"
      >
        {entries.map((entry) => (
          <LogLine key={`${entry.mono}-${entry.category}-${entry.message}`} entry={entry} />
        ))}
      </ScrollView>
    </View>
  );
}
