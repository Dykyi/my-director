import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@features/capture/capture-session-context';
import { colors } from '@features/capture/components/theme';
import { SegmentUpload } from '@features/upload/components/segment-upload';
import { UploadButton } from '@features/upload/components/upload-button';
import { segmentObjectKey } from '@features/upload/upload-format';
import { useUploadsState } from '@features/upload/uploads-context';

import { RecordingsView } from './components/recordings-view';
import { useRecordingsState } from './recordings-context';

export function RecordingsScreen() {
  const { snapshot, health, actions: session } = useSession();
  const { recordings, error, actions } = useRecordingsState();
  const uploads = useUploadsState();
  const { refresh } = actions;
  useFocusEffect(useCallback(() => void refresh(), [refresh]));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top']}>
      <RecordingsView
        recordings={recordings}
        activeSessionId={snapshot.sessionId}
        diskFreeBytes={health?.diskFreeBytes}
        error={error ?? uploads.error}
        onBack={() => router.navigate('/')}
        onSimulateCrash={__DEV__ ? session.simulateCrash : undefined}
        onPlay={(uri) => router.navigate({ pathname: '/player', params: { uri } })}
        onShare={actions.share}
        onVerify={(id) => router.navigate(`/verification/${id}`)}
        onDelete={actions.remove}
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
    </SafeAreaView>
  );
}
