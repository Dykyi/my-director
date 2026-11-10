import { router } from 'expo-router';

import { useUploads } from '@features/upload/uploads-context';

import type { CardHandlers } from './components/recording-card';
import { useConfirmDelete } from './use-confirm-delete';

export function useCardHandlers(): CardHandlers {
  const uploads = useUploads();
  const confirmDelete = useConfirmDelete();
  return {
    play: (recording) =>
      router.navigate({ pathname: '/player', params: { sessionId: recording.sessionId } }),
    verify: (recording) => router.navigate(`/verification/${recording.sessionId}`),
    upload: (recording) => void uploads.actions.startRecording(recording),
    cancel: (recording) => void uploads.actions.cancelRecording(recording),
    delete: confirmDelete,
  };
}
