import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CaptureSessionProvider } from '@features/capture/capture-session-context';
import { RecordingsProvider } from '@features/recordings/recordings-context';
import { UploadsProvider } from '@features/upload/uploads-context';
import { FONTS } from '@theme/fonts';
import { useThemeName } from '@theme/use-theme-colors';

import { useAppTheme } from './use-app-theme';

export function RootProviders({ children }: { children: ReactNode }) {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const theme = useThemeName();
  useAppTheme();
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <CaptureSessionProvider>
        <RecordingsProvider>
          <UploadsProvider>{children}</UploadsProvider>
        </RecordingsProvider>
      </CaptureSessionProvider>
    </SafeAreaProvider>
  );
}
