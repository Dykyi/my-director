import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import type { ComponentType, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  CaptureSessionProvider,
  EventLogProvider,
  HealthProvider,
} from '@features/capture/capture-session-context';
import { RecordingsProvider } from '@features/recordings/recordings-context';
import { UploadsProvider } from '@features/upload/uploads-context';
import { FONTS } from '@theme/fonts';
import { useThemeName } from '@theme/use-theme-colors';
import { GestureHandlerRootView } from '@ui/styled';

import { useAppTheme } from './use-app-theme';

// require behind __DEV__, not import: the minifier drops the dead branch together with the module.
const StorybookButton: ComponentType | null =
  __DEV__ && process.env.EXPO_PUBLIC_SCREENSHOTS !== '1'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@features/dev/storybook-button').StorybookButton
    : null;

export function RootProviders({ children }: { children: ReactNode }) {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const theme = useThemeName();
  useAppTheme();
  // Every text style names an Inter or JetBrains Mono face; a failed load falls back to the system face.
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <CaptureSessionProvider>
          <HealthProvider>
            <EventLogProvider>
              <RecordingsProvider>
                <UploadsProvider>
                  {children}
                  {StorybookButton && <StorybookButton />}
                </UploadsProvider>
              </RecordingsProvider>
            </EventLogProvider>
          </HealthProvider>
        </CaptureSessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
