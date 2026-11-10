import type { ReactNode } from 'react';
import { Alert, Text, View } from 'react-native';

import type {
  RecordingState,
  RecordingSummary,
  SegmentState,
  SegmentSummary,
} from '@modules/capture-core';

import { ActionButton, IconButton } from '@features/capture/components/action-button';
import { colors, mono } from '@features/capture/components/theme';
import { PAUSE_REASON } from '@features/capture/session-labels';
import { formatBytes, formatDuration, formatSessionTime, plural } from '@shared/format';

const STATE_PILL: Record<RecordingState, { background: string; text: string }> = {
  recording: { background: colors.recordingSurface, text: colors.recordingText },
  paused: { background: colors.pausedSurface, text: colors.pausedText },
  finished: { background: colors.okSurface, text: colors.level },
  recovered: { background: colors.pausedSurface, text: colors.pausedText },
};

const PLAYABLE: ReadonlySet<SegmentState> = new Set(['finalized', 'recovered']);

export type RecordingCardProps = {
  recording: RecordingSummary;
  isActive: boolean;
  onPlay: (uri: string) => void;
  onShare: (uri: string) => void;
  onVerify: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  renderSegment?: (recording: RecordingSummary, segment: SegmentSummary) => ReactNode;
  renderActions?: (recording: RecordingSummary) => ReactNode;
};

function SegmentRow({
  segment,
  onPlay,
  onShare,
}: {
  segment: SegmentSummary;
  onPlay: () => void;
  onShare: () => void;
}) {
  const playable = PLAYABLE.has(segment.state);
  const reason = segment.pauseReason ? ` · ${PAUSE_REASON[segment.pauseReason].label}` : '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text
        selectable
        numberOfLines={2}
        style={[
          mono,
          {
            flex: 1,
            color: segment.state === 'unplayable' ? colors.recordingText : colors.secondary,
          },
        ]}
      >
        seg {segment.index} {formatDuration(segment.durationSec)} {segment.state}
        {reason}
        {segment.failure ? ` · ${segment.failure}` : ''}
      </Text>
      <IconButton
        icon="play.fill"
        label={`Play segment ${segment.index}`}
        disabled={!playable}
        onPress={onPlay}
      />
      <IconButton
        icon="square.and.arrow.up"
        label={`Share segment ${segment.index}`}
        disabled={!playable}
        onPress={onShare}
      />
    </View>
  );
}

export function RecordingCard({
  recording,
  isActive,
  onPlay,
  onShare,
  onVerify,
  onDelete,
  renderSegment,
  renderActions,
}: RecordingCardProps) {
  const pill = STATE_PILL[recording.state];
  const confirmDelete = () =>
    Alert.alert(
      'Delete this recording?',
      `${plural(recording.segments.length, 'segment')}, ${formatBytes(recording.totalBytes)} will be removed from the phone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(recording.sessionId) },
      ],
    );
  return (
    <View
      style={{
        padding: 14,
        gap: 10,
        borderRadius: 14,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
          {formatSessionTime(recording.createdAt)}
        </Text>
        <Text selectable style={[mono, { flexShrink: 1, color: colors.muted }]}>
          {formatDuration(recording.totalSec)} · {plural(recording.segments.length, 'seg')} ·{' '}
          {formatBytes(recording.totalBytes)}
        </Text>
        <Text
          style={{
            marginLeft: 'auto',
            paddingVertical: 2,
            paddingHorizontal: 8,
            borderRadius: 999,
            overflow: 'hidden',
            backgroundColor: pill.background,
            color: pill.text,
            fontSize: 12,
            fontWeight: '600',
          }}
        >
          {recording.state}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        {recording.segments.map((segment) => (
          <View key={segment.index}>
            <SegmentRow
              segment={segment}
              onPlay={() => onPlay(segment.uri)}
              onShare={() => onShare(segment.uri)}
            />
            {renderSegment?.(recording, segment)}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ActionButton
          title="Verify"
          size="compact"
          onPress={() => onVerify(recording.sessionId)}
          style={{ flex: 1 }}
        />
        {!isActive && (
          <ActionButton
            title="Delete"
            variant="ghost"
            size="compact"
            onPress={confirmDelete}
            style={{ flex: 1 }}
          />
        )}
        {renderActions?.(recording)}
      </View>
    </View>
  );
}
