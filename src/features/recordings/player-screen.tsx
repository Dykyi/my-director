import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RecordingSummary, RecoveryReport } from '@modules/capture-core';

import { formatSessionTime } from '@shared/format';
import { EmptyState } from '@ui/empty-state';
import { CloseButton } from '@ui/icon-button';
import { SafeAreaView } from '@ui/styled';

import { Player } from './components/player';
import { playerView, startingSegment } from './player-view';
import { recordingMeta } from './recording-labels';
import { useRecordingsState } from './recordings-context';
import { useSegmentPlayer } from './use-segment-player';

const close = () => router.back();

function RecordingPlayer({
  recording,
  start,
  report,
}: {
  recording: RecordingSummary;
  start: number;
  report: RecoveryReport | undefined;
}) {
  const { player, position, select } = useSegmentPlayer(recording.segments, start);
  return (
    <Player
      title={formatSessionTime(recording.createdAt)}
      meta={recordingMeta(recording)}
      recovered={recording.state === 'recovered'}
      player={player}
      view={playerView(recording, position, report)}
      onSelect={select}
      onClose={close}
    />
  );
}

export function PlayerScreen() {
  return (
    <SafeAreaProvider>
      <PlayerContent />
    </SafeAreaProvider>
  );
}

function PlayerContent() {
  const { sessionId, segment } = useLocalSearchParams<{ sessionId: string; segment?: string }>();
  const { recordings, recoveryReports } = useRecordingsState();
  const recording = recordings.find((candidate) => candidate.sessionId === sessionId);
  const start = recording && startingSegment(recording.segments, Number(segment));
  if (!recording || start === undefined) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 gap-4 bg-background p-4">
        <View className="items-end">
          <CloseButton onPress={close} />
        </View>
        <EmptyState
          icon="film"
          title="Nothing to play"
          text="No segment of this recording opens."
        />
      </SafeAreaView>
    );
  }
  return (
    <RecordingPlayer
      key={sessionId}
      recording={recording}
      start={start}
      report={recoveryReports.find((candidate) => candidate.sessionId === sessionId)}
    />
  );
}
