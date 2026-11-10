import { Linking, StyleSheet, Text, View } from 'react-native';

import {
  CapturePreview,
  type HealthSnapshot,
  type PauseReason,
  type PermissionsState,
  type SessionSnapshot,
} from '@modules/capture-core';

import { PAUSE_REASON } from '../session-labels';
import { ActionButton } from './action-button';
import { SymbolIcon } from './symbol-icon';
import { colors, gutter, mono } from './theme';

const PREVIEW_HEIGHT = 300;
const PREVIEW_MIN_HEIGHT = 160;

const PAUSE_ICON: Partial<Record<PauseReason, string>> = {
  user: 'pause.circle',
  phoneCall: 'phone.fill',
  appBackground: 'house.fill',
  screenLocked: 'lock.fill',
};

function PermissionGate({
  permissions,
  onRequest,
}: {
  permissions: PermissionsState;
  onRequest: () => void;
}) {
  const denied = permissions.camera === 'denied' || permissions.microphone === 'denied';
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: gutter,
      }}
    >
      <SymbolIcon name="video.slash" size={40} color={colors.faint} />
      <Text selectable style={[mono, { color: colors.muted }]}>
        Camera: {permissions.camera} · Microphone: {permissions.microphone}
      </Text>
      {denied ? (
        <ActionButton
          title="Open Settings"
          size="compact"
          onPress={() => void Linking.openSettings()}
        />
      ) : (
        <ActionButton title="Allow camera and microphone" size="compact" onPress={onRequest} />
      )}
    </View>
  );
}

function PauseOverlay({ reason, savedSegments }: { reason: PauseReason; savedSegments: number }) {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: colors.scrim,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          paddingHorizontal: 32,
        },
      ]}
    >
      <SymbolIcon
        name={PAUSE_ICON[reason] ?? 'exclamationmark.triangle'}
        size={44}
        color={colors.muted}
      />
      <Text style={{ color: colors.secondary, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
        {PAUSE_REASON[reason].detail} Segment {savedSegments} is closed and safe on disk.
      </Text>
    </View>
  );
}

export function PreviewPanel({
  snapshot,
  health,
  permissions,
  onRequestPermissions,
}: {
  snapshot: SessionSnapshot;
  health: HealthSnapshot | null;
  permissions: PermissionsState;
  onRequestPermissions: () => void;
}) {
  const { phase, pauseReason } = snapshot;
  const cameraLive = phase !== 'idle' && phase !== 'preparing';
  const granted = permissions.camera === 'granted' && permissions.microphone === 'granted';
  return (
    <View
      style={{
        height: PREVIEW_HEIGHT,
        minHeight: PREVIEW_MIN_HEIGHT,
        flexShrink: 1,
        backgroundColor: colors.surface,
        overflow: 'hidden',
      }}
    >
      {cameraLive ? (
        <CapturePreview style={StyleSheet.absoluteFill} videoGravity="aspectFill" />
      ) : granted ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.muted, fontSize: 14 }}>
            {phase === 'preparing' ? 'Starting camera…' : 'Camera off'}
          </Text>
        </View>
      ) : (
        <PermissionGate permissions={permissions} onRequest={onRequestPermissions} />
      )}
      {phase === 'recording' && health && (
        <Text
          style={[
            mono,
            {
              position: 'absolute',
              top: 10,
              right: 12,
              paddingVertical: 3,
              paddingHorizontal: 8,
              borderRadius: 6,
              overflow: 'hidden',
              backgroundColor: colors.badge,
              fontSize: 11,
              color: colors.secondary,
            },
          ]}
        >
          REC {health.file.fps.toFixed(0)} fps
        </Text>
      )}
      {phase === 'paused' && pauseReason && (
        <PauseOverlay reason={pauseReason} savedSegments={snapshot.segmentIndex} />
      )}
    </View>
  );
}
