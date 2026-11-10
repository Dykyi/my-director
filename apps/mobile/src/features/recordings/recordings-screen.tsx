import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView } from 'react-native';

import { useSession } from '@features/capture/capture-session-context';
import { TabScreen } from '@features/shell/tab-screen';
import { UploadProgress } from '@features/upload/components/upload-progress';
import { segmentObjectKey } from '@features/upload/upload-format';
import { useUploadsState } from '@features/upload/uploads-context';
import { formatBytes, plural } from '@shared/format';
import { EmptyState } from '@ui/empty-state';
import { Text } from '@ui/text';

import { RecordingCard, type CardHandlers } from './components/recording-card';
import { segmentLine } from './recording-labels';
import { useRecordingsState } from './recordings-context';
import { useConfirmDelete } from './use-confirm-delete';

export function RecordingsScreen() {
  const { snapshot, health } = useSession();
  const { recordings, error, actions } = useRecordingsState();
  const uploads = useUploadsState();
  const { refresh } = actions;
  useFocusEffect(useCallback(() => void refresh(), [refresh]));

  const confirmDelete = useConfirmDelete();

  const handlers: CardHandlers = {
    play: (recording) =>
      router.navigate({ pathname: '/player', params: { sessionId: recording.sessionId } }),
    verify: (recording) => router.navigate(`/verification/${recording.sessionId}`),
    upload: (recording) => void uploads.actions.startRecording(recording),
    cancel: (recording) => void uploads.actions.cancelRecording(recording),
    delete: confirmDelete,
  };

  const fact = [
    plural(recordings.length, 'session'),
    health && `${formatBytes(health.diskFreeBytes)} free`,
  ]
    .filter(Boolean)
    .join(' · ');
  const failure = error ?? uploads.error;
  return (
    <TabScreen title="Recordings" fact={fact}>
      <ScrollView className="flex-1" contentContainerClassName="gap-3 p-4">
        {failure && (
          <Text selectable variant="footnote" className="text-danger">
            {failure}
          </Text>
        )}
        {recordings.length === 0 ? (
          <EmptyState icon="film" title="No recordings yet" text="Start one on the Record tab." />
        ) : (
          recordings.map((recording) => (
            <RecordingCard
              key={recording.sessionId}
              recording={recording}
              status={uploads.uploadStatus(recording)}
              isActive={recording.sessionId === snapshot.sessionId}
              handlers={handlers}
              renderSegment={(segment) => (
                <UploadProgress
                  key={segment.index}
                  label={segmentLine(segment)}
                  upload={uploads.uploadFor(segmentObjectKey(recording.sessionId, segment.index))}
                  actions={uploads.actions}
                />
              )}
            />
          ))
        )}
      </ScrollView>
    </TabScreen>
  );
}
