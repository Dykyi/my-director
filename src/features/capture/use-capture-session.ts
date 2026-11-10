import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  CaptureCore,
  isCaptureError,
  type CaptureConfigInput,
  type HealthSnapshot,
  type LogEntry,
  type PermissionsState,
  type SessionSnapshot,
} from '@modules/capture-core';
import { callCredentials } from '@/src/config/env';

const LOG_LIMIT = 200;

export function describeError(error: unknown): string {
  return isCaptureError(error) ? `${error.code}: ${error.message}` : String(error);
}

function allGranted(permissions: PermissionsState): boolean {
  return permissions.camera === 'granted' && permissions.microphone === 'granted';
}

export function useCaptureSession(config: CaptureConfigInput) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() => CaptureCore.getSnapshot());
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [permissions, setPermissions] = useState<PermissionsState>(() => CaptureCore.getPermissions());
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setPermissions(CaptureCore.getPermissions());
    });
    return () => subscription.remove();
  }, []);

  const run = useCallback(async (command: () => Promise<unknown>) => {
    setCommandError(null);
    try {
      await command();
    } catch (error) {
      setCommandError(describeError(error));
    }
  }, []);

  const preparedRef = useRef(false);
  const granted = allGranted(permissions);
  const cameraIdle = snapshot.phase === 'idle';
  useEffect(() => {
    if (!granted || !cameraIdle || preparedRef.current) return;
    preparedRef.current = true;
    CaptureCore.prepare(config).catch((error: unknown) => setCommandError(describeError(error)));
  }, [granted, cameraIdle, config]);

  const actions = useMemo(
    () => ({
      requestPermissions: () => run(async () => setPermissions(await CaptureCore.requestPermissions())),
      prepare: () => run(() => CaptureCore.prepare(config)),
      start: () => run(() => CaptureCore.start(callCredentials())),
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
    [config, run],
  );

  return { snapshot, health, logs, permissions, commandError, actions };
}

export type CaptureSessionActions = ReturnType<typeof useCaptureSession>['actions'];
