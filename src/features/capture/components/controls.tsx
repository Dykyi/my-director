import { View } from 'react-native';

import type { SessionSnapshot } from '@modules/capture-core';

import { PHASE_PROGRESS, plural } from '../session-labels';
import type { CaptureSessionActions } from '../use-capture-session';
import { ActionButton } from './action-button';
import { colors, gutter } from './theme';

const ROW = { flexDirection: 'row', gap: 10 } as const;

function PhaseButtons({
  snapshot,
  actions,
}: {
  snapshot: SessionSnapshot;
  actions: CaptureSessionActions;
}) {
  const { phase } = snapshot;
  switch (phase) {
    case 'idle':
      return <ActionButton title="Retry camera" icon="camera" onPress={actions.prepare} />;
    case 'ready':
      return (
        <ActionButton
          title="Start recording"
          variant="record"
          icon="circle.fill"
          onPress={actions.start}
        />
      );
    case 'recording':
      return (
        <View style={ROW}>
          <ActionButton
            title="Pause"
            icon="pause.fill"
            onPress={actions.pause}
            style={{ flex: 1 }}
          />
          <ActionButton
            title="Stop"
            variant="primary"
            icon="stop.fill"
            onPress={actions.stop}
            style={{ flex: 1 }}
          />
        </View>
      );
    case 'paused':
      return (
        <>
          <ActionButton
            title="Resume"
            variant="resume"
            size="large"
            icon="play.fill"
            onPress={actions.resume}
          />
          <ActionButton
            title={`Stop and keep ${plural(snapshot.segmentIndex, 'segment')}`}
            size="compact"
            onPress={actions.stop}
          />
        </>
      );
    default:
      return <ActionButton title={PHASE_PROGRESS[phase] ?? phase} disabled />;
  }
}

export function Controls({
  snapshot,
  actions,
}: {
  snapshot: SessionSnapshot;
  actions: CaptureSessionActions;
}) {
  const { phase, call } = snapshot;
  const canReconnect =
    (phase === 'recording' || phase === 'paused') && call.state === 'disconnected';
  return (
    <View
      style={{
        paddingHorizontal: gutter,
        paddingVertical: 14,
        gap: 10,
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}
    >
      <PhaseButtons snapshot={snapshot} actions={actions} />
      {canReconnect && (
        <ActionButton
          title="Reconnect call"
          variant="notice"
          size="compact"
          icon="arrow.clockwise"
          onPress={actions.reconnectCall}
        />
      )}
    </View>
  );
}
