import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

import { VerificationReport } from './components/verification-report';
import { useRecordingsState } from './recordings-context';

export function VerificationScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { verification, actions } = useRecordingsState();
  const start = useEffectEvent(() => actions.verify(sessionId));
  const finish = useEffectEvent(() => actions.closeVerification());
  useEffect(() => {
    void start();
    return () => finish();
  }, [sessionId]);
  return <VerificationReport report={verification} onClose={() => router.back()} />;
}
