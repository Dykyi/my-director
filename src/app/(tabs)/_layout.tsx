import { Tabs } from 'expo-router/js-tabs';

import { RecoveryHost } from '@features/recordings/recovery-host';
import { RemoteControlProvider } from '@features/remote/use-stand-commands';
import { AppTabBar } from '@features/shell/app-tab-bar';
import { APP_TABS } from '@features/shell/app-tabs';
import { useThemeColors } from '@theme/use-theme-colors';

export default function TabsLayout() {
  const { background } = useThemeColors();
  return (
    <RemoteControlProvider>
      <RecoveryHost />
      <Tabs
        tabBar={(props) => <AppTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: background } }}
      >
        {APP_TABS.map(({ name, title }) => (
          <Tabs.Screen key={name} name={name} options={{ title }} />
        ))}
      </Tabs>
    </RemoteControlProvider>
  );
}
