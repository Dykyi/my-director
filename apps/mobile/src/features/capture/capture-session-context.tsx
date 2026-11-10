import { useMemo } from 'react';

import type { CameraPosition } from '@modules/capture-core';

import { captureOverrides } from '@config/capture-config';
import { useAccess } from '@features/access/use-access';
import { hookContext } from '@shared/hook-context';

import { cameraPreference } from './camera-preference';
import { sessionIssues, type SessionIssue } from './session-issues';
import { useCaptureSession } from './use-capture-session';

function useSessionWithCamera() {
  const cameraPosition = cameraPreference.use();
  const access = useAccess();
  const overrides = useMemo(() => captureOverrides(cameraPosition), [cameraPosition]);
  return { ...useCaptureSession(overrides, access.ready), access };
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
