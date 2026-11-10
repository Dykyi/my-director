import { StyleSheet, Text, View } from 'react-native';

import type { RecoveryReport, SegmentState } from '@modules/capture-core';

import { formatDuration, formatLoss, formatSessionTime } from '../format';
import { plural } from '../session-labels';
import { ActionButton } from './action-button';
import { SymbolIcon } from './symbol-icon';
import { colors, gutter, mono } from './theme';

const PLAYABLE: ReadonlySet<SegmentState> = new Set(['finalized', 'recovered']);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, padding: 10, gap: 2, borderRadius: 10, borderCurve: 'continuous', backgroundColor: colors.ground }}>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
      <Text selectable style={[mono, { fontSize: 16, fontWeight: '600' }]}>
        {value}
      </Text>
    </View>
  );
}

export function RecoveryDialog({ report, onPlay, onVerify, onDismiss }: {
  report: RecoveryReport | undefined;
  onPlay: (uri: string) => void;
  onVerify: (sessionId: string) => void;
  onDismiss: (sessionId: string) => void;
}) {
  if (!report) return null;
  const lastPlayable = report.segments.findLast((segment) => PLAYABLE.has(segment.state));
  const unplayable = report.segments.filter((segment) => segment.state === 'unplayable').length;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, justifyContent: 'center', paddingHorizontal: gutter }]}>
      <View
        accessibilityRole="alert"
        style={{
          padding: 18,
          gap: 14,
          borderRadius: 16,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SymbolIcon name="clock.arrow.circlepath" size={22} color={colors.accent} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
              Unfinished recording · {formatSessionTime(report.createdAt)}
            </Text>
            <Text style={{ color: colors.secondary, fontSize: 14, lineHeight: 20 }}>
              The app was closed while recording.{' '}
              {lastPlayable ? 'What was on disk is playable.' : 'Nothing on disk could be opened.'}
            </Text>
            {unplayable > 0 && lastPlayable && (
              <Text style={{ color: colors.recordingText, fontSize: 13 }}>{plural(unplayable, 'segment')} could not be opened.</Text>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat label="Recovered" value={formatDuration(report.recoveredSec)} />
          <Stat label="Lost" value={formatLoss(report)} />
          <Stat label="Segments" value={String(report.segments.length)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ActionButton
            title="Play"
            variant="primary"
            size="compact"
            disabled={!lastPlayable}
            onPress={() => lastPlayable && onPlay(lastPlayable.uri)}
            style={{ flex: 1 }}
          />
          <ActionButton title="Verify" size="compact" onPress={() => onVerify(report.sessionId)} style={{ flex: 1 }} />
          <ActionButton title="Dismiss" variant="ghost" size="compact" onPress={() => onDismiss(report.sessionId)} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}
