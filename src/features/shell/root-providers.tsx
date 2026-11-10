import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CaptureSessionProvider } from '@features/capture/capture-session-context';
import { RecordingsProvider } from '@features/recordings/recordings-context';
import { UploadsProvider } from '@features/upload/uploads-context';

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <CaptureSessionProvider>
        <RecordingsProvider>
          <UploadsProvider>{children}</UploadsProvider>
        </RecordingsProvider>
      </CaptureSessionProvider>
    </SafeAreaProvider>
  );
}
