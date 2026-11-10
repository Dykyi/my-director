import { router } from 'expo-router';

import { useChangeCamera, useSession } from '@features/capture/capture-session-context';
import { useRecordingsState } from '@features/recordings/recordings-context';
import { useUploadsState } from '@features/upload/uploads-context';
import { hookContext } from '@shared/hook-context';
import { appearance } from '@theme/appearance';

import { STAND_ROUTES } from './stand-routes';
import { useRemoteControl } from './use-remote-control';

const routeCommands = Object.fromEntries(
  Object.entries(STAND_ROUTES).map(([name, route]) => [name, () => router.navigate(route)]),
);

function useStandCommands() {
  const { actions } = useSession();
  const changeCamera = useChangeCamera();
  const recordings = useRecordingsState();
  const uploads = useUploadsState();
  const latest = recordings.recordings[0];
  const recoveryReport = recordings.recoveryReports[0];
  return useRemoteControl({
    ...routeCommands,
    permissions: actions.requestPermissions,
    prepare: () => actions.prepare(),
    start: actions.start,
    pause: actions.pause,
    resume: actions.resume,
    stop: actions.stop,
    reconnect: actions.reconnectCall,
    dismiss: actions.dismissError,
    verify: () => latest && router.navigate(`/verification/${latest.sessionId}`),
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

export const [RemoteControlProvider, useRemoteStatus] = hookContext(
  'RemoteControl',
  useStandCommands,
);
