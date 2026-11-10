import { Tabs } from 'expo-router/js-tabs';

import { RecoveryHost } from '@features/recordings/recovery-host';
import { RemoteControlProvider } from '@features/remote/use-stand-commands';

export default function TabsLayout() {
  return (
    <RemoteControlProvider>
      <RecoveryHost />
      <Tabs screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" options={{ title: 'Record' }} />
        <Tabs.Screen name="recordings" options={{ title: 'Recordings' }} />
      </Tabs>
    </RemoteControlProvider>
  );
}
