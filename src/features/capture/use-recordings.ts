import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';

import {
  CaptureCore,
  type RecordingSummary,
  type RecoveryReport,
  type VerificationReport,
} from '@modules/capture-core';

import { describeError } from './use-capture-session';

const QUICKTIME = { mimeType: 'video/quicktime', UTI: 'com.apple.quicktime-movie' } as const;

export function useRecordings() {
  const [recordings, setRecordings] = useState<RecordingSummary[]>([]);
  const [recoveryReports, setRecoveryReports] = useState<RecoveryReport[]>([]);
  const [verification, setVerification] = useState<VerificationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reportError = useCallback((caught: unknown) => setError(describeError(caught)), []);

  const guard = useCallback(
    async (action: () => Promise<void>) => {
      setError(null);
      try {
        await action();
      } catch (caught) {
        reportError(caught);
      }
    },
    [reportError],
  );

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

  const share = (uri: string) => guard(() => Sharing.shareAsync(uri, QUICKTIME));

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
      share,
      remove,
      closeVerification: () => setVerification(null),
    },
  };
}

export type RecordingsActions = ReturnType<typeof useRecordings>['actions'];
