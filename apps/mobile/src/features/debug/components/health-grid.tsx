import { View } from 'react-native';

import type { HealthSnapshot, SessionSnapshot } from '@modules/capture-core';

import { METER_BARS } from '@features/capture/session-labels';
import { cn } from '@ui/cn';
import { LevelMeter } from '@ui/level-meter';
import { Text } from '@ui/text';
import { textTone } from '@ui/tone';

import { healthRows } from '../health-rows';

export function HealthGrid({
  health,
  snapshot,
}: {
  health: HealthSnapshot | null;
  snapshot: SessionSnapshot;
}) {
  return (
    <View accessibilityLabel="Health" className="gap-1 border-b border-border px-4 py-2.5">
      {health ? (
        healthRows(health, snapshot).map((row) => (
          <View key={row.label} className="flex-row items-center">
            <Text variant="mono-value" className="w-16 text-muted">
              {row.label}
            </Text>
            <View className="flex-1 flex-row items-center gap-2">
              {row.meterBars !== undefined && (
                <LevelMeter size="grid" lit={row.meterBars} total={METER_BARS} />
              )}
              <Text
                selectable
                numberOfLines={1}
                variant="mono-value"
                className={cn('shrink', textTone({ tone: row.tone }))}
              >
                {row.value}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text variant="mono-value" className="text-muted">
          Waiting for the first health report…
        </Text>
      )}
    </View>
  );
}
