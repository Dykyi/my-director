import { Linking, View } from 'react-native';

import { Button } from '@ui/button';
import { ErrorNotice, WarningNotice } from '@ui/notice';

import type { RecordNoticesView } from '../record-views';

export function RecordNotices({
  view,
  onDismiss,
}: {
  view: RecordNoticesView | null;
  onDismiss: () => void;
}) {
  if (!view) return null;
  const { error, warnings } = view;
  return (
    <View className="gap-2 px-4 pt-2">
      {error && (
        <ErrorNotice title={error.title} message={error.message}>
          {error.openSettings && (
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
      {warnings.map((message) => (
        <WarningNotice key={message} message={message} />
      ))}
    </View>
  );
}
