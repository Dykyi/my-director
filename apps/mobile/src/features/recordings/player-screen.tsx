import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RecordingSummary, RecoveryReport } from '@modules/capture-core';

import { formatSessionTime } from '@shared/format';

import { NothingToPlay } from './components/nothing-to-play';
import { Player } from './components/player';
import { playerTarget, playerView } from './player-view';
import { recordingMeta } from './recording-labels';
import { useRecordings } from './recordings-context';
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
  // iOS takes the screens under a full-screen modal out of the window, and the root provider's insets drop to zero.
  return (
    <SafeAreaProvider>
      <PlayerContent />
    </SafeAreaProvider>
  );
}

function PlayerContent() {
  const { sessionId, segment } = useLocalSearchParams<{ sessionId: string; segment?: string }>();
  const { recordings, recoveryReports } = useRecordings();
  const target = playerTarget(recordings, recoveryReports, sessionId, segment);
  if (!target) return <NothingToPlay onClose={close} />;
  return (
    <RecordingPlayer
      key={sessionId}
      recording={target.recording}
      start={target.start}
      report={target.report}
    />
  );
}
