import { router } from 'expo-router';
import { useEffect } from 'react';

import { RecoveryDialog } from './components/recovery-dialog';
import { useRecordingsState } from './recordings-context';

export function RecoveryScreen() {
  const { recoveryReports, actions } = useRecordingsState();
  const report = recoveryReports[0];
  useEffect(() => {
    if (!report) router.back();
  }, [report]);
  return (
    <RecoveryDialog
      report={report}
      onPlay={(uri) => router.navigate({ pathname: '/player', params: { uri } })}
      onVerify={(id) => router.navigate(`/verification/${id}`)}
      onDismiss={actions.acknowledge}
    />
  );
}
