import { useEffect } from 'react';

import { useCaptureSession } from '@features/capture/capture-session-context';
import { createHookContext } from '@shared/hook-context';

import { useNativeRecordings } from './use-native-recordings';

function useRecordingsRefreshedOnStop() {
  const recordings = useNativeRecordings();
  const { snapshot } = useCaptureSession();
  const { refresh } = recordings.actions;
  useEffect(() => {
    if (snapshot.phase === 'ready') void refresh();
  }, [snapshot.phase, refresh]);
  return recordings;
}

export const [RecordingsProvider, useRecordings] = createHookContext(
  'Recordings',
  useRecordingsRefreshedOnStop,
);
export type Recordings = ReturnType<typeof useRecordings>;
