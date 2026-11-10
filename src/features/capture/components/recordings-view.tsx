import { Pressable, ScrollView, Text, View } from 'react-native';

import type { RecordingSummary } from '@modules/capture-core';

import { formatBytes } from '../format';
import { ActionButton } from './action-button';
import { RecordingCard, type RecordingCardProps } from './recording-card';
import { SymbolIcon } from './symbol-icon';
import { colors, gutter, mono } from './theme';

type CardHandlers = Omit<RecordingCardProps, 'recording' | 'isActive'>;

export function RecordingsView({
  recordings,
  activeSessionId,
  diskFreeBytes,
  error,
  onBack,
  onSimulateCrash,
  ...handlers
}: CardHandlers & {
  recordings: RecordingSummary[];
  activeSessionId?: string;
  diskFreeBytes?: number;
  error: string | null;
  onBack: () => void;
  onSimulateCrash?: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          height: 52,
          paddingHorizontal: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to capture"
          onPress={onBack}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <SymbolIcon name="chevron.left" size={20} color={colors.accent} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}
        >
          Recordings
        </Text>
        {diskFreeBytes !== undefined && (
          <Text style={{ marginLeft: 'auto', paddingRight: 8, color: colors.muted, fontSize: 13 }}>
            {formatBytes(diskFreeBytes)} free
          </Text>
        )}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: gutter, gap: 12 }}>
        {error && (
          <Text selectable style={{ color: colors.recordingText, fontSize: 13 }}>
            {error}
          </Text>
        )}
        {recordings.length === 0 ? (
          <Text style={[mono, { color: colors.muted }]}>No recordings yet</Text>
        ) : (
          recordings.map((recording) => (
            <RecordingCard
              key={recording.sessionId}
              recording={recording}
              isActive={recording.sessionId === activeSessionId}
              {...handlers}
            />
          ))
        )}
      </ScrollView>
      {onSimulateCrash && (
        <View
          style={{
            paddingHorizontal: gutter,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>Debug build</Text>
          <ActionButton
            title="Simulate crash"
            variant="danger"
            size="compact"
            onPress={onSimulateCrash}
            style={{ marginLeft: 'auto' }}
          />
        </View>
      )}
    </View>
  );
}
