import { useEffect } from 'react';

import { useSession } from '@features/capture/capture-session-context';
import { hookContext } from '@shared/hook-context';

import { useRecordings } from './use-recordings';

function useRecordingsOfSession() {
  const recordings = useRecordings();
  const { snapshot } = useSession();
  const { refresh } = recordings.actions;
  useEffect(() => {
    if (snapshot.phase === 'ready') void refresh();
  }, [snapshot.phase, refresh]);
  return recordings;
}

export const [RecordingsProvider, useRecordingsState] = hookContext(
  'Recordings',
  useRecordingsOfSession,
);
export type Recordings = ReturnType<typeof useRecordingsState>;
