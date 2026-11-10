import { useCallback, useEffect, useState } from 'react';

import {
  CaptureCore,
  type RecordingSummary,
  type RecoveryReport,
  type VerificationReport,
} from '@modules/capture-core';

import { useReportedErrors } from '@shared/use-reported-errors';

export function useNativeRecordings() {
  const [recordings, setRecordings] = useState<RecordingSummary[]>([]);
  const [recoveryReports, setRecoveryReports] = useState<RecoveryReport[]>([]);
  const [verification, setVerification] = useState<VerificationReport | null>(null);
  const { error, reportError, guard } = useReportedErrors();

  const refresh = useCallback(
    () => CaptureCore.listRecordings().then(setRecordings, reportError),
    [reportError],
  );

  useEffect(() => {
    void refresh();
    void CaptureCore.getRecoveryReports().then(setRecoveryReports, reportError);
    const subscription = CaptureCore.addListener('onRecoveryFound', ({ reports }) => {
      setRecoveryReports(reports);
      void refresh();
    });
    return () => subscription.remove();
  }, [refresh, reportError]);

  const acknowledge = (sessionId: string) =>
    guard(async () => {
      await CaptureCore.acknowledgeRecovery(sessionId);
      setRecoveryReports((current) => current.filter((report) => report.sessionId !== sessionId));
    });

  const verify = (sessionId: string) =>
    guard(async () => setVerification(await CaptureCore.verifyRecording(sessionId)));

  const remove = (sessionId: string) =>
    guard(async () => {
      await CaptureCore.deleteRecording(sessionId);
      await refresh();
    });

  return {
    recordings,
    recoveryReports,
    verification,
    error,
    actions: {
      refresh,
      acknowledge,
      verify,
      remove,
      closeVerification: () => setVerification(null),
    },
  };
}
