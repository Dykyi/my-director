import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { captureConfig } from '@config/capture-config';
import { useRemoteControl } from '@features/remote/use-remote-control';
import { SegmentUpload } from '@features/upload/components/segment-upload';
import { UploadButton } from '@features/upload/components/upload-button';
import { segmentObjectKey } from '@features/upload/upload-format';
import { useUploads } from '@features/upload/use-uploads';

import { Controls } from './components/controls';
import { EventLog } from './components/event-log';
import { HealthPanel } from './components/health-panel';
import { Notices } from './components/notices';
import { PlayerModal } from './components/player-modal';
import { PreviewPanel } from './components/preview-panel';
import { RecordingsView } from './components/recordings-view';
import { RecoveryDialog } from './components/recovery-dialog';
import { StatusHeader } from './components/status-header';
import { colors, gutter } from './components/theme';
import { VerificationSheet } from './components/verification-sheet';
import { plural } from './session-labels';
import { useCaptureSession } from './use-capture-session';
import { useRecordings } from './use-recordings';

function RecordingsLink({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        height: 52,
        paddingHorizontal: gutter,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>Recordings</Text>
      <Text style={{ color: colors.muted, fontSize: 15 }}>{plural(count, 'session')} ›</Text>
    </Pressable>
  );
}

export function CaptureScreen() {
  const { snapshot, health, logs, permissions, commandError, actions } =
    useCaptureSession(captureConfig);
  const recordings = useRecordings();
  const uploads = useUploads();
  const [playing, setPlaying] = useState<string | null>(null);
  const [showingRecordings, setShowingRecordings] = useState(false);
  const refreshRecordings = recordings.actions.refresh;
  const recoveryReport = recordings.recoveryReports[0];
  const latest = recordings.recordings[0];

  useEffect(() => {
    if (snapshot.phase === 'ready') void refreshRecordings();
  }, [snapshot.phase, refreshRecordings]);

  const openRecordings = () => {
    void refreshRecordings();
    setShowingRecordings(true);
  };

  useRemoteControl({
    permissions: actions.requestPermissions,
    prepare: actions.prepare,
    start: actions.start,
    pause: actions.pause,
    resume: actions.resume,
    stop: actions.stop,
    reconnect: actions.reconnectCall,
    dismiss: actions.dismissError,
    recordings: openRecordings,
    back: () => setShowingRecordings(false),
    verify: () => latest && recordings.actions.verify(latest.sessionId),
    upload: () => latest && uploads.actions.startRecording(latest),
    'close-sheet': () => {
      recordings.actions.closeVerification();
      setPlaying(null);
    },
    'dismiss-recovery': () =>
      recoveryReport && recordings.actions.acknowledge(recoveryReport.sessionId),
    sigkill: () => actions.simulateCrash?.(),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top', 'bottom']}>
      {showingRecordings ? (
        <RecordingsView
          recordings={recordings.recordings}
          activeSessionId={snapshot.sessionId}
          diskFreeBytes={health?.diskFreeBytes}
          error={recordings.error ?? uploads.error}
          onBack={() => setShowingRecordings(false)}
          onSimulateCrash={__DEV__ ? actions.simulateCrash : undefined}
          onPlay={setPlaying}
          onShare={recordings.actions.share}
          onVerify={recordings.actions.verify}
          onDelete={recordings.actions.remove}
          renderSegment={(recording, segment) => (
            <SegmentUpload
              upload={uploads.uploadFor(segmentObjectKey(recording.sessionId, segment.index))}
              actions={uploads.actions}
            />
          )}
          renderActions={(recording) => (
            <UploadButton
              status={uploads.uploadStatus(recording)}
              onUpload={() => uploads.actions.startRecording(recording)}
            />
          )}
        />
      ) : (
        <>
          <StatusHeader snapshot={snapshot} />
          <Notices
            snapshot={snapshot}
            commandError={commandError}
            onDismiss={actions.dismissError}
          />
          <PreviewPanel
            snapshot={snapshot}
            health={health}
            permissions={permissions}
            onRequestPermissions={actions.requestPermissions}
          />
          <Controls snapshot={snapshot} actions={actions} />
          <HealthPanel health={health} snapshot={snapshot} />
          <EventLog entries={logs} />
          <RecordingsLink count={recordings.recordings.length} onPress={openRecordings} />
        </>
      )}
      <RecoveryDialog
        report={recoveryReport}
        onPlay={setPlaying}
        onVerify={recordings.actions.verify}
        onDismiss={recordings.actions.acknowledge}
      />
      <VerificationSheet
        report={recordings.verification}
        onClose={recordings.actions.closeVerification}
      />
      <PlayerModal uri={playing} onClose={() => setPlaying(null)} />
    </SafeAreaView>
  );
}
