import { Alert, type AlertButton } from 'react-native';

import type { RecordingSummary } from '@modules/capture-core';

import { useUploadsState } from '@features/upload/uploads-context';

import { deleteMessage } from './recording-labels';
import { useRecordingsState } from './recordings-context';

export function useConfirmDelete() {
  const { actions } = useRecordingsState();
  const uploads = useUploadsState();

  return (recording: RecordingSummary) => {
    const uploaded = uploads.keysInBucket(recording).length;
    const removeLocally = () => void actions.remove(recording.sessionId);
    const removeEverywhere = async () => {
      if (await uploads.actions.removeFromBucket(recording)) removeLocally();
    };
    const choices: AlertButton[] =
      uploaded > 0
        ? [
            {
              text: 'Delete from phone and bucket',
              style: 'destructive',
              onPress: () => void removeEverywhere(),
            },
            { text: 'Delete from phone only', style: 'destructive', onPress: removeLocally },
          ]
        : [{ text: 'Delete', style: 'destructive', onPress: removeLocally }];
    Alert.alert('Delete this recording?', deleteMessage(recording, uploaded), [
      ...choices,
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
}
