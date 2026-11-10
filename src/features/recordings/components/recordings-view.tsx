import { ScrollView, Text, View } from 'react-native';

import type { RecordingSummary } from '@modules/capture-core';

import { ActionButton } from '@features/capture/components/action-button';
import { colors, gutter, mono } from '@features/capture/components/theme';

import { RecordingCard, type RecordingCardProps } from './recording-card';

type CardHandlers = Omit<RecordingCardProps, 'recording' | 'isActive'>;

export function RecordingsView({
  recordings,
  activeSessionId,
  error,
  onSimulateCrash,
  ...handlers
}: CardHandlers & {
  recordings: RecordingSummary[];
  activeSessionId?: string;
  error: string | null;
  onSimulateCrash?: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
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
