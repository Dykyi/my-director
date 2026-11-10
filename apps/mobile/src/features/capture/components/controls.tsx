import { View } from 'react-native';

import type { SessionSnapshot } from '@modules/capture-core';

import { plural } from '@shared/format';
import { Button } from '@ui/button';

import { canReconnectCall } from '../record-views';
import { PHASE_PROGRESS } from '../session-labels';
import type { CaptureSessionActions } from '../use-native-session';

function PhaseButtons({
  snapshot,
  actions,
  accessReady,
}: {
  snapshot: SessionSnapshot;
  actions: CaptureSessionActions;
  accessReady: boolean;
}) {
  const { phase } = snapshot;
  switch (phase) {
    case 'idle':
      if (!accessReady) {
        return <Button title="Start recording" variant="record" size="large" icon="dot" disabled />;
      }
      return (
        <Button title="Retry camera" size="large" icon="camera" onPress={() => actions.prepare()} />
      );
    case 'ready':
      return (
        <Button
          title="Start recording"
          variant="record"
          size="large"
          icon="dot"
          onPress={actions.start}
        />
      );
    case 'recording':
      return (
        <View className="flex-row gap-2.5">
          <Button
            title="Pause"
            size="large"
            icon="pause"
            onPress={actions.pause}
            className="flex-1"
          />
          <Button
            title="Stop"
            variant="primary"
            size="large"
            icon="stop"
            onPress={actions.stop}
            className="flex-1"
          />
        </View>
      );
    case 'paused':
      return (
        <>
          <Button
            title="Resume"
            variant="resume"
            size="large"
            icon="play"
            onPress={actions.resume}
          />
          <Button
            title={`Stop and keep ${plural(snapshot.segmentIndex, 'segment')}`}
            onPress={actions.stop}
          />
        </>
      );
    default:
      return <Button title={PHASE_PROGRESS[phase] ?? phase} size="large" disabled />;
  }
}

export function Controls({
  snapshot,
  actions,
  accessReady,
}: {
  snapshot: SessionSnapshot;
  actions: CaptureSessionActions;
  accessReady: boolean;
}) {
  return (
    <View className="gap-2.5 border-t border-border px-4 pb-4 pt-3">
      <PhaseButtons snapshot={snapshot} actions={actions} accessReady={accessReady} />
      {canReconnectCall(snapshot) && (
        <Button
          title="Reconnect call"
          variant="notice"
          size="compact"
          icon="rotate"
          onPress={actions.reconnectCall}
        />
      )}
    </View>
  );
}
