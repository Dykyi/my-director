import { router } from 'expo-router';
import { useEffect } from 'react';

import { useSession } from '@features/capture/capture-session-context';

import { RecoveryDialog } from './components/recovery-dialog';
import { lossNote } from './recording-labels';
import { useRecordingsState } from './recordings-context';

export function RecoveryScreen() {
  const { recoveryReports, actions } = useRecordingsState();
  const { config } = useSession();
  const report = recoveryReports[0];
  useEffect(() => {
    if (!report) router.back();
  }, [report]);
  return (
    <RecoveryDialog
      report={report}
      note={lossNote(config)}
      onPlay={(uri) => router.navigate({ pathname: '/player', params: { uri } })}
      onVerify={(id) => router.navigate(`/verification/${id}`)}
      onDismiss={actions.acknowledge}
    />
  );
}
