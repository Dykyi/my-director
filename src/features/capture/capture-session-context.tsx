import { useMemo } from 'react';

import type { CameraPosition } from '@modules/capture-core';

import { captureOverrides } from '@config/capture-config';
import { hookContext } from '@shared/hook-context';

import { cameraPreference } from './camera-preference';
import { sessionIssues, type SessionIssue } from './session-issues';
import { useCaptureSession } from './use-capture-session';

function useSessionWithCamera() {
  const cameraPosition = cameraPreference.use();
  return useCaptureSession(useMemo(() => captureOverrides(cameraPosition), [cameraPosition]));
}

export const [CaptureSessionProvider, useSession] = hookContext(
  'CaptureSession',
  useSessionWithCamera,
);

export function useChangeCamera() {
  const { actions } = useSession();
  return async (position: CameraPosition | undefined) => {
    if (await actions.prepare(captureOverrides(position))) cameraPreference.set(position);
  };
}

export function useSessionIssues(): SessionIssue[] {
  const { snapshot, logs } = useSession();
  return useMemo(() => sessionIssues(snapshot, logs), [snapshot, logs]);
}
