import { Text, View } from 'react-native';

import type { SessionSnapshot } from '@modules/capture-core';

import { formatDuration } from '../format';
import { describeCall, PAUSE_REASON, PHASE_PILL, type PillTone } from '../session-labels';
import { SymbolIcon } from './symbol-icon';
import { colors, gutter, mono, toneColor } from './theme';

const PILL_LOOK: Record<PillTone, { background: string; text: string }> = {
  neutral: { background: colors.raised, text: colors.text },
  recording: { background: colors.recordingSurface, text: colors.recordingText },
  paused: { background: colors.pausedSurface, text: colors.pausedText },
};

function PillMark({ tone }: { tone: PillTone }) {
  if (tone === 'paused') return <SymbolIcon name="pause.fill" size={10} color={colors.pausedText} />;
  return (
    <View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        ...(tone === 'recording'
          ? { backgroundColor: colors.recordingDot }
          : { borderWidth: 1.5, borderColor: colors.muted }),
      }}
    />
  );
}

export function StatusHeader({ snapshot }: { snapshot: SessionSnapshot }) {
  const { phase, pauseReason, sessionId, call } = snapshot;
  const pill = PHASE_PILL[phase];
  const look = PILL_LOOK[pill.tone];
  const reason = phase === 'paused' && pauseReason ? PAUSE_REASON[pauseReason] : undefined;
  const callLine = describeCall(call, sessionId !== undefined);
  return (
    <View
      style={{ paddingHorizontal: gutter, paddingTop: 14, paddingBottom: 10, gap: 4, borderBottomWidth: 1, borderColor: colors.border }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          accessibilityRole="header"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: look.background,
          }}
        >
          <PillMark tone={pill.tone} />
          <Text style={{ color: look.text, fontSize: 13, fontWeight: '700', letterSpacing: 0.8 }}>{pill.label}</Text>
        </View>
        {reason ? (
          <Text style={{ color: reason.isFault ? colors.recordingText : colors.pausedText, fontSize: 14, fontWeight: '600' }}>
            {reason.label}
          </Text>
        ) : (
          <Text selectable style={[mono, { fontSize: 20, fontWeight: '600', color: phase === 'recording' ? colors.text : colors.muted }]}>
            {formatDuration(snapshot.recordedSec)}
          </Text>
        )}
        <Text selectable style={[mono, { marginLeft: 'auto', fontSize: 13, color: colors.muted }]}>
          {reason ? `${formatDuration(snapshot.recordedSec)} · ` : ''}
          {sessionId === undefined ? 'no session' : `seg ${snapshot.segmentIndex}`}
        </Text>
      </View>
      <Text selectable style={{ fontSize: 13, color: toneColor[callLine.tone] }}>
        {callLine.text}
      </Text>
    </View>
  );
}
