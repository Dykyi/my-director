import { router } from 'expo-router';
import { useEffect } from 'react';

import { useCaptureSession } from '@features/capture/capture-session-context';

import { RecoveryDialog } from './components/recovery-dialog';
import { lossNote } from './recording-labels';
import { useRecordings } from './recordings-context';

export function RecoveryScreen() {
  const { recoveryReports, actions } = useRecordings();
  const { config } = useCaptureSession();
  const report = recoveryReports[0];
  useEffect(() => {
    if (!report) router.back();
  }, [report]);
  return (
    <RecoveryDialog
      report={report}
      note={lossNote(config)}
      onPlay={(sessionId, segment) =>
        router.navigate({ pathname: '/player', params: { sessionId, segment } })
      }
      onVerify={(id) => router.navigate(`/verification/${id}`)}
      onDismiss={actions.acknowledge}
    />
  );
}
