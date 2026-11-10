import { Text, View } from 'react-native';

import type { HealthSnapshot, SessionSnapshot } from '@modules/capture-core';

import { healthRows, METER_BARS } from '../health-rows';
import { colors, gutter, mono, toneColor } from './theme';

const LABEL_WIDTH = 64;

function Meter({ bars }: { bars: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: METER_BARS }, (_, index) => (
        <View key={index} style={{ width: 6, height: 10, backgroundColor: index < bars ? colors.level : colors.levelOff }} />
      ))}
    </View>
  );
}

export function HealthPanel({ health, snapshot }: { health: HealthSnapshot | null; snapshot: SessionSnapshot }) {
  return (
    <View
      accessibilityLabel="Health"
      style={{ paddingHorizontal: gutter, paddingVertical: 10, gap: 4, borderBottomWidth: 1, borderColor: colors.border }}
    >
      {health ? (
        healthRows(health, snapshot).map((row) => (
          <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[mono, { width: LABEL_WIDTH, color: colors.muted }]}>{row.label}</Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {row.meterBars !== undefined && <Meter bars={row.meterBars} />}
              <Text selectable numberOfLines={1} style={[mono, { flexShrink: 1, color: toneColor[row.tone] }]}>
                {row.value}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={[mono, { color: colors.muted }]}>Waiting for the first health report…</Text>
      )}
    </View>
  );
}
