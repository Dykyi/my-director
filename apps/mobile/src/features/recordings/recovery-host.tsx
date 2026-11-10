import { router } from 'expo-router';
import { useEffect } from 'react';

import { useRecordings } from './recordings-context';

export function RecoveryHost() {
  const hasReport = useRecordings().recoveryReports.length > 0;
  useEffect(() => {
    if (hasReport) router.navigate('/recovery');
  }, [hasReport]);
  return null;
}
