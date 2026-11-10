import { View } from 'react-native';

import { CallChip } from '@features/capture/components/call-chip';
import { Button } from '@ui/button';
import { StatusDot } from '@ui/status-dot';
import { Text } from '@ui/text';

import type { ConnectionView } from '../room-labels';
import { RoomCard } from './room-card';

export function ConnectionCard({
  view,
  canReconnect,
  onReconnect,
}: {
  view: ConnectionView;
  canReconnect: boolean;
  onReconnect: () => void;
}) {
  return (
    <RoomCard>
      <View className="flex-row items-center gap-2.5">
        <StatusDot tone={view.live ? 'live' : 'idle'} />
        <View className="flex-1 gap-0.5">
          <Text variant="row-title" className="text-foreground">
            {view.title}
          </Text>
          {view.detail ? (
            <Text selectable variant="footnote" className="text-muted">
              {view.detail}
            </Text>
          ) : null}
        </View>
        <CallChip chip={view.chip} />
      </View>
      {view.text !== undefined && (
        <Text variant="callout" className="text-subtle">
          {view.text}
        </Text>
      )}
      {canReconnect && (
        <View className="gap-1.5">
          <Button title="Reconnect" size="compact" icon="rotate" onPress={onReconnect} />
          <Text variant="caption" className="text-muted">
            Leaves the room and joins again. The recording on the phone keeps going.
          </Text>
        </View>
      )}
    </RoomCard>
  );
}
