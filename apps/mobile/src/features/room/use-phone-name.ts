import { Alert } from 'react-native';

import { callName, DEFAULT_CALL_NAME } from '@features/call/call-identity';
import { useCaptureSession } from '@features/capture/capture-session-context';

export function usePhoneName() {
  const { actions } = useCaptureSession();
  const name = callName.use() ?? DEFAULT_CALL_NAME;
  const rename = () =>
    Alert.prompt(
      'Name in the call',
      'The interviewer sees this name.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          isPreferred: true,
          onPress: (value?: string) => void actions.renameCall(value ?? ''),
        },
      ],
      'plain-text',
      name,
    );
  return { name, rename };
}
