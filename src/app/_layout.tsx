import '../global.css';

import { Stack } from 'expo-router';

import { RootProviders } from '@features/shell/root-providers';
import { useThemeColors } from '@theme/use-theme-colors';

export default function RootLayout() {
  const { background } = useThemeColors();
  return (
    <RootProviders>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="verification/[sessionId]" options={{ presentation: 'pageSheet' }} />
        <Stack.Screen name="player" options={{ presentation: 'pageSheet' }} />
        <Stack.Screen name="room" options={{ presentation: 'pageSheet' }} />
        <Stack.Screen
          name="recovery"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        {/* Development only: the route, like the bundle, is absent from release builds. */}
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="storybook" />
        </Stack.Protected>
      </Stack>
    </RootProviders>
  );
}
