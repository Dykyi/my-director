import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CaptureCore,
  type CaptureConfig,
  type CaptureConfigInput,
  type SessionSnapshot,
} from '@modules/capture-core';

import { callCredentials } from '@config/env';
import { describeError } from '@shared/describe-error';

/** `overrides` must be a stable object (a constant or a memo). */
export function useNativeSession(overrides: CaptureConfigInput, accessReady: boolean) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() => CaptureCore.getSnapshot());
  const [config, setConfig] = useState<CaptureConfig>(() => CaptureCore.getConfig());
  const [commandError, setCommandError] = useState<string | null>(null);

  useEffect(() => {
    const subscription = CaptureCore.addListener('onStateChange', setSnapshot);
    return () => subscription.remove();
  }, []);

  const runCommand = useCallback(async (command: () => Promise<unknown>) => {
    setCommandError(null);
    try {
      await command();
      return true;
    } catch (error) {
      setCommandError(describeError(error));
      return false;
    }
  }, []);

  // Prepare once, as soon as access is settled; a failed camera is retried by the user, not in a loop.
  // A JS reload finds the native session already prepared or recording, so only an idle camera is prepared.
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
        runCommand(async () => setConfig(await CaptureCore.prepare(next))),
      start: () => runCommand(() => CaptureCore.start(callCredentials)),
      pause: () => runCommand(CaptureCore.pause),
      resume: () => runCommand(CaptureCore.resume),
      reconnectCall: () => runCommand(CaptureCore.reconnectCall),
      stop: () => runCommand(CaptureCore.stop),
      dismissError: () => {
        setCommandError(null);
        void CaptureCore.dismissError();
      },
      simulateCrash: CaptureCore.simulateCrash,
    }),
    [overrides, runCommand],
  );

  return { snapshot, config, commandError, actions };
}

export type CaptureSessionActions = ReturnType<typeof useNativeSession>['actions'];
