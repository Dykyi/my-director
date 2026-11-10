import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CaptureCore,
  type CaptureConfig,
  type CaptureConfigInput,
  type HealthSnapshot,
  type LogEntry,
  type SessionSnapshot,
} from '@modules/capture-core';

import { callCredentials } from '@config/env';
import { describeError } from '@shared/describe-error';

const LOG_LIMIT = 200;

export function useCaptureSession(overrides: CaptureConfigInput, accessReady: boolean) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() => CaptureCore.getSnapshot());
  const [config, setConfig] = useState<CaptureConfig>(() => CaptureCore.getConfig());
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [commandError, setCommandError] = useState<string | null>(null);

  useEffect(() => {
    const subscriptions = [
      CaptureCore.addListener('onStateChange', setSnapshot),
      CaptureCore.addListener('onHealth', setHealth),
      CaptureCore.addListener('onLog', (entry) => {
        if (entry.level !== 'debug') setLogs((current) => [entry, ...current].slice(0, LOG_LIMIT));
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  const run = useCallback(async (command: () => Promise<unknown>) => {
    setCommandError(null);
    try {
      await command();
      return true;
    } catch (error) {
      setCommandError(describeError(error));
      return false;
    }
  }, []);

  const preparedRef = useRef(false);
  const cameraIdle = snapshot.phase === 'idle';
  useEffect(() => {
    if (!accessReady || !cameraIdle || preparedRef.current) return;
    preparedRef.current = true;
    CaptureCore.prepare(overrides)
      .then(setConfig)
      .catch((error: unknown) => setCommandError(describeError(error)));
  }, [accessReady, cameraIdle, overrides]);

  const actions = useMemo(
    () => ({
      prepare: (next: CaptureConfigInput = overrides) =>
        run(async () => setConfig(await CaptureCore.prepare(next))),
      start: () => run(() => CaptureCore.start(callCredentials)),
      pause: () => run(CaptureCore.pause),
      resume: () => run(CaptureCore.resume),
      reconnectCall: () => run(CaptureCore.reconnectCall),
      stop: () => run(CaptureCore.stop),
      dismissError: () => {
        setCommandError(null);
        void CaptureCore.dismissError();
      },
      simulateCrash: CaptureCore.simulateCrash,
    }),
    [overrides, run],
  );

  return { snapshot, config, health, logs, commandError, actions };
}

export type CaptureSession = ReturnType<typeof useCaptureSession>;
export type CaptureSessionActions = ReturnType<typeof useCaptureSession>['actions'];
