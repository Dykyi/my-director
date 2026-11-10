import {
  useCaptureSession,
  useEventLog,
  useHealth,
  useSessionIssues,
} from '@features/capture/capture-session-context';
import { issueBadge } from '@features/capture/session-issues';
import { useRemoteStatus } from '@features/remote/use-stand-commands';
import { TabScreen } from '@features/shell/tab-screen';

import { CrashRow } from './components/crash-row';
import { EventLog } from './components/event-log';
import { HealthGrid } from './components/health-grid';
import { RemoteStatus } from './components/remote-status';

export function DebugScreen() {
  const { snapshot, actions } = useCaptureSession();
  const health = useHealth();
  const logs = useEventLog();
  const badge = issueBadge(useSessionIssues());
  const { lastCommand } = useRemoteStatus();
  return (
    <TabScreen title="Debug" fact="updates every second" compact>
      <HealthGrid health={health} snapshot={snapshot} />
      <EventLog entries={logs} badge={badge} />
      {__DEV__ && (
        <>
          <RemoteStatus lastCommand={lastCommand} />
          <CrashRow onCrash={actions.simulateCrash} />
        </>
      )}
    </TabScreen>
  );
}
