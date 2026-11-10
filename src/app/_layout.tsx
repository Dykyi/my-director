import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@features/capture/components/theme';
import { RootProviders } from '@features/shell/root-providers';

export default function RootLayout() {
  return (
    <RootProviders>
      <ThemeProvider value={DarkTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="verification/[sessionId]" options={{ presentation: 'pageSheet' }} />
          <Stack.Screen name="player" options={{ presentation: 'pageSheet' }} />
          <Stack.Screen
            name="recovery"
            options={{
              presentation: 'transparentModal',
              animation: 'fade',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
        </Stack>
      </ThemeProvider>
    </RootProviders>
  );
}
