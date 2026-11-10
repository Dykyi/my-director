import { Linking, View } from 'react-native';

import type { SessionSnapshot } from '@modules/capture-core';

import { Button } from '@ui/button';
import { ErrorNotice, WarningNotice } from '@ui/notice';

export function RecordNotices({
  snapshot,
  commandError,
  onDismiss,
}: {
  snapshot: SessionSnapshot;
  commandError: string | null;
  onDismiss: () => void;
}) {
  const { error, warnings, phase, call } = snapshot;
  const callDown = phase === 'recording' && call.state !== 'connected';
  if (!error && !commandError && !callDown && warnings.length === 0) return null;
  const notice = error
    ? { title: error.code, message: error.message }
    : commandError && { title: 'Command failed', message: commandError };
  return (
    <View className="gap-2 px-4 pt-2">
      {notice && (
        <ErrorNotice title={notice.title} message={notice.message}>
          {error?.code === 'permissionDenied' && (
            <Button
              title="Open Settings"
              variant="danger"
              size="compact"
              onPress={() => void Linking.openSettings()}
            />
          )}
          <Button title="Dismiss" variant="danger" size="compact" onPress={onDismiss} />
        </ErrorNotice>
      )}
      {callDown && (
        <WarningNotice
          message={`The call ${call.state === 'reconnecting' ? 'is reconnecting' : 'dropped'}. Recording continues on the phone with full quality.`}
        />
      )}
      {warnings.map((warning) => (
        <WarningNotice key={warning.code} message={warning.message} />
      ))}
    </View>
  );
}
