import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView } from 'react-native';

import { useCaptureSession, useHealth } from '@features/capture/capture-session-context';
import { TabScreen } from '@features/shell/tab-screen';
import { UploadProgress } from '@features/upload/components/upload-progress';
import { segmentObjectKey } from '@features/upload/upload-format';
import { useUploads } from '@features/upload/uploads-context';
import { EmptyState } from '@ui/empty-state';
import { Text } from '@ui/text';

import { RecordingCard } from './components/recording-card';
import { recordingsFact, segmentLine } from './recording-labels';
import { useRecordings } from './recordings-context';
import { shareSegment } from './share-segment';
import { useCardHandlers } from './use-card-handlers';

export function RecordingsScreen() {
  const { snapshot } = useCaptureSession();
  const health = useHealth();
  const { recordings, error, actions } = useRecordings();
  const uploads = useUploads();
  const { refresh } = actions;
  useFocusEffect(useCallback(() => void refresh(), [refresh]));
  const handlers = useCardHandlers();

  const fact = recordingsFact(recordings.length, health);
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
                  share={() => shareSegment(segment.uri)}
                />
              )}
            />
          ))
        )}
      </ScrollView>
    </TabScreen>
  );
}
