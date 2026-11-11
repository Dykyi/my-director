import { router } from 'expo-router';

import { useCaptureSession, useChangeCamera } from '@features/capture/capture-session-context';
import { useRecordings } from '@features/recordings/recordings-context';
import { useUploads } from '@features/upload/uploads-context';
import { createHookContext } from '@shared/hook-context';
import { appearance } from '@theme/appearance';

import { STAND_ROUTES } from './stand-routes';
import { useRemoteControl } from './use-remote-control';

const routeCommands = Object.fromEntries(
  Object.entries(STAND_ROUTES).map(([name, route]) => [name, () => router.navigate(route)]),
);

function useStandCommands() {
  const { actions, access } = useCaptureSession();
  const changeCamera = useChangeCamera();
  const recordings = useRecordings();
  const uploads = useUploads();
  const latest = recordings.recordings[0];
  const recoveryReport = recordings.recoveryReports[0];
  return useRemoteControl({
    ...routeCommands,
    permissions: () => access.perform('ask'),
    prepare: () => actions.prepare(),
    start: actions.start,
    pause: actions.pause,
    resume: actions.resume,
    stop: actions.stop,
    reconnect: actions.reconnectCall,
    dismiss: actions.dismissError,
    verify: () => latest && router.navigate(`/verification/${latest.sessionId}`),
    play: () =>
      latest && router.navigate({ pathname: '/player', params: { sessionId: latest.sessionId } }),
    upload: () => latest && uploads.actions.startRecording(latest),
    'close-sheet': () => router.canDismiss() && router.dismissAll(),
    'dismiss-recovery': () =>
      recoveryReport && recordings.actions.acknowledge(recoveryReport.sessionId),
    sigkill: () => actions.simulateCrash?.(),
    'camera-front': () => changeCamera('front'),
    'camera-back': () => changeCamera('back'),
    'camera-default': () => changeCamera(undefined),
    'theme-system': () => appearance.set('system'),
    'theme-light': () => appearance.set('light'),
    'theme-dark': () => appearance.set('dark'),
  });
}

/** Stand commands navigate, so the provider sits inside the tab navigator, which is ready by then. */
export const [RemoteControlProvider, useRemoteStatus] = createHookContext(
  'RemoteControl',
  useStandCommands,
);
