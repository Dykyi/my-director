import { useEffect, useMemo, useState } from 'react';

import {
  CaptureCore,
  type CameraPosition,
  type HealthSnapshot,
  type LogEntry,
} from '@modules/capture-core';

import { captureOverrides } from '@config/capture-config';
import { useAccess } from '@features/access/use-access';
import { createHookContext } from '@shared/hook-context';

import { cameraPreference } from './camera-preference';
import { sessionIssues, type SessionIssue } from './session-issues';
import { useNativeSession } from './use-native-session';

function useCaptureSessionValue() {
  const cameraPosition = cameraPreference.use();
  const access = useAccess();
  const overrides = useMemo(() => captureOverrides(cameraPosition), [cameraPosition]);
  return { ...useNativeSession(overrides, access.ready), access };
}

const LOG_LIMIT = 200;

function useNativeHealth() {
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  useEffect(() => {
    const subscription = CaptureCore.addListener('onHealth', setHealth);
    return () => subscription.remove();
  }, []);
  return health;
}

function useNativeLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  useEffect(() => {
    const subscription = CaptureCore.addListener('onLog', (entry) => {
      if (entry.level !== 'debug') setLogs((current) => [entry, ...current].slice(0, LOG_LIMIT));
    });
    return () => subscription.remove();
  }, []);
  return logs;
}

// Health comes every second and the log with every event; apart, they re-render only their readers.
export const [CaptureSessionProvider, useCaptureSession] = createHookContext(
  'CaptureSession',
  useCaptureSessionValue,
);
export const [HealthProvider, useHealth] = createHookContext('Health', useNativeHealth);
export const [EventLogProvider, useEventLog] = createHookContext('EventLog', useNativeLog);

export function useChangeCamera() {
  const { actions } = useCaptureSession();
  return async (position: CameraPosition | undefined) => {
    if (await actions.prepare(captureOverrides(position))) cameraPreference.set(position);
  };
}

export function useSessionIssues(): SessionIssue[] {
  const { snapshot } = useCaptureSession();
  const logs = useEventLog();
  return useMemo(() => sessionIssues(snapshot, logs), [snapshot, logs]);
}
