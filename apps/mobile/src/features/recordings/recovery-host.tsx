import { router } from 'expo-router';
import { useEffect } from 'react';

import { useRecordingsState } from './recordings-context';

export function RecoveryHost() {
  const hasReport = useRecordingsState().recoveryReports.length > 0;
  useEffect(() => {
    if (hasReport) router.navigate('/recovery');
  }, [hasReport]);
  return null;
}
