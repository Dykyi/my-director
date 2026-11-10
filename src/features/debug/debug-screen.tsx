import { View } from 'react-native';

import { useSession, useSessionIssues } from '@features/capture/capture-session-context';
import { issueBadge } from '@features/capture/session-issues';
import { TabScreen } from '@features/shell/tab-screen';
import { Button } from '@ui/button';
import { Text } from '@ui/text';

import { EventLog } from './components/event-log';
import { HealthGrid } from './components/health-grid';
import { RemoteStatus } from './components/remote-status';

export function DebugScreen() {
  const { snapshot, health, logs, actions } = useSession();
  const badge = issueBadge(useSessionIssues());
  return (
    <TabScreen title="Debug" fact="updates every second" compact>
      <HealthGrid health={health} snapshot={snapshot} />
      <EventLog entries={logs} badge={badge} />
      {__DEV__ && (
        <>
          <RemoteStatus />
          <View className="flex-row items-center gap-2.5 px-4 py-2.5">
            <Text variant="caption" className="text-muted">
              Debug build only
            </Text>
            <Button
              title="Simulate crash"
              variant="danger"
              size="compact"
              className="ml-auto"
              onPress={actions.simulateCrash}
            />
          </View>
        </>
      )}
    </TabScreen>
  );
}
