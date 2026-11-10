import { SafeAreaView } from 'react-native-safe-area-context';

import { EventLog } from '@features/debug/components/event-log';
import { HealthPanel } from '@features/debug/components/health-panel';

import { useSession } from './capture-session-context';
import { Controls } from './components/controls';
import { Notices } from './components/notices';
import { PreviewPanel } from './components/preview-panel';
import { StatusHeader } from './components/status-header';
import { colors } from './components/theme';

export function RecordScreen() {
  const { snapshot, health, logs, permissions, commandError, actions } = useSession();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top']}>
      <StatusHeader snapshot={snapshot} />
      <Notices snapshot={snapshot} commandError={commandError} onDismiss={actions.dismissError} />
      <PreviewPanel
        snapshot={snapshot}
        health={health}
        permissions={permissions}
        onRequestPermissions={actions.requestPermissions}
      />
      <Controls snapshot={snapshot} actions={actions} />
      <HealthPanel health={health} snapshot={snapshot} />
      <EventLog entries={logs} />
    </SafeAreaView>
  );
}
