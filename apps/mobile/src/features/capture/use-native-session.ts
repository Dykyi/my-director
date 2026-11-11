import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CaptureCore,
  type CaptureConfig,
  type CaptureConfigInput,
  type SessionSnapshot,
} from '@modules/capture-core';

import { uploadApi } from '@config/env';
import { callName, normalizeCallName } from '@features/call/call-identity';
import { joinCall } from '@features/call/call-token';
import { describeError } from '@shared/describe-error';
import { singleFlight } from '@shared/single-flight';

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

  // Start waits for the token before the phase changes; a second tap meanwhile would ask again and fail.
  const start = useMemo(
    () => singleFlight(() => runCommand(() => joinCall(uploadApi, CaptureCore.start))),
    [runCommand],
  );

  const actions = useMemo(
    () => ({
      prepare: (next: CaptureConfigInput = overrides) =>
        runCommand(async () => setConfig(await CaptureCore.prepare(next))),
      start,
      pause: () => runCommand(CaptureCore.pause),
      resume: () => runCommand(CaptureCore.resume),
      reconnectCall: () => runCommand(CaptureCore.reconnectCall),
      /** Kept for the next token; the native side applies it now in a call and again after a rejoin. */
      renameCall: (value: string) => {
        const name = normalizeCallName(value);
        callName.set(name);
        return runCommand(() => CaptureCore.setCallName(name));
      },
      stop: () => runCommand(CaptureCore.stop),
      dismissError: () => {
        setCommandError(null);
        void CaptureCore.dismissError();
      },
      simulateCrash: CaptureCore.simulateCrash,
    }),
    [overrides, runCommand, start],
  );

  return { snapshot, config, commandError, actions };
}

export type CaptureSessionActions = ReturnType<typeof useNativeSession>['actions'];
