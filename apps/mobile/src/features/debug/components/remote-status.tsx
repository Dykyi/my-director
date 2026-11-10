import { View } from 'react-native';

import { HEALTH_LOG_INTERVAL_MS, type LastCommand } from '@features/remote/use-remote-control';
import { formatClock } from '@shared/format';
import { Text } from '@ui/text';

const MS_PER_SEC = 1_000;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row">
      <Text variant="caption" className="w-24 text-muted">
        {label}
      </Text>
      <Text selectable variant="caption" className="flex-1 text-foreground">
        {value}
      </Text>
    </View>
  );
}

export function RemoteStatus({ lastCommand }: { lastCommand: LastCommand | undefined }) {
  const links = lastCommand
    ? `listening · last: ${lastCommand.name} at ${formatClock(lastCommand.at)}`
    : 'listening';
  return (
    <View className="gap-1 border-b border-border px-4 py-2">
      <Row label="Stand links" value={links} />
      <Row
        label="Metro mirror"
        value={`log, health every ${HEALTH_LOG_INTERVAL_MS / MS_PER_SEC} s, uploads`}
      />
    </View>
  );
}
