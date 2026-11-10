import { Linking, Text, View } from 'react-native';

import type { SessionSnapshot } from '@modules/capture-core';

import { ActionButton } from './action-button';
import { SymbolIcon } from './symbol-icon';
import { colors, gutter } from './theme';

function Alert({ title, message, showSettings, onDismiss }: {
  title?: string;
  message: string;
  showSettings: boolean;
  onDismiss: () => void;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: 12,
        gap: 8,
        borderRadius: 10,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.recordButton,
        backgroundColor: colors.recordingSurface,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SymbolIcon name="exclamationmark.circle" size={16} color={colors.recordingText} />
        <View style={{ flex: 1, gap: 2 }}>
          {title && (
            <Text selectable style={{ color: colors.alertText, fontSize: 14, fontWeight: '700' }}>
              {title}
            </Text>
          )}
          <Text selectable style={{ color: colors.alertText, fontSize: 13, lineHeight: 18 }}>
            {message}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        {showSettings && <ActionButton title="Open Settings" variant="danger" size="compact" onPress={() => void Linking.openSettings()} />}
        <ActionButton title="Dismiss" variant="danger" size="compact" onPress={onDismiss} />
      </View>
    </View>
  );
}

function Notice({ message }: { message: string }) {
  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.noticeBorder,
        backgroundColor: colors.noticeSurface,
      }}
    >
      <SymbolIcon name="exclamationmark.triangle" size={16} color={colors.pausedText} />
      <Text selectable style={{ flex: 1, color: colors.noticeText, fontSize: 13, lineHeight: 18 }}>
        {message}
      </Text>
    </View>
  );
}

export function Notices({ snapshot, commandError, onDismiss }: {
  snapshot: SessionSnapshot;
  commandError: string | null;
  onDismiss: () => void;
}) {
  const { error, warnings, phase, call } = snapshot;
  const callDown = phase === 'recording' && call.state !== 'connected';
  if (!error && !commandError && !callDown && warnings.length === 0) return null;
  return (
    <View style={{ paddingHorizontal: gutter, paddingTop: 10, gap: 8 }}>
      {error ? (
        <Alert title={error.code} message={error.message} showSettings={error.code === 'permissionDenied'} onDismiss={onDismiss} />
      ) : (
        commandError && <Alert message={commandError} showSettings={false} onDismiss={onDismiss} />
      )}
      {callDown && (
        <Notice
          message={`The call ${call.state === 'reconnecting' ? 'is reconnecting' : 'dropped'}. Recording continues on the phone with full quality.`}
        />
      )}
      {warnings.map((warning) => (
        <Notice key={warning.code} message={warning.message} />
      ))}
    </View>
  );
}
