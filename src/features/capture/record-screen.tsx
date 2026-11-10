import { router } from 'expo-router';

import { callTarget } from '@config/env';
import { formatTimer } from '@shared/format';
import { SafeAreaView } from '@ui/styled';

import { useSession, useSessionIssues } from './capture-session-context';
import { CallRow } from './components/call-row';
import { Controls } from './components/controls';
import { HealthLine } from './components/health-line';
import { PreviewPanel } from './components/preview-panel';
import { RecordHeader } from './components/record-header';
import { RecordNotices } from './components/record-notices';
import { callRowView, headerFact } from './record-views';
import { healthLine } from './session-issues';
import { PHASE_PILL } from './session-labels';

export function RecordScreen() {
  const { snapshot, health, config, permissions, commandError, actions } = useSession();
  const line = healthLine(useSessionIssues(), snapshot);
  const room = snapshot.call.room ?? callTarget.room ?? '';
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <RecordHeader
        pill={PHASE_PILL[snapshot.phase]}
        time={formatTimer(snapshot.recordedSec)}
        live={snapshot.phase === 'recording'}
        fact={headerFact(snapshot, health, config.recording)}
      />
      <RecordNotices
        snapshot={snapshot}
        commandError={commandError}
        onDismiss={actions.dismissError}
      />
      <CallRow
        view={callRowView(snapshot, config.call.profiles, room)}
        onPress={() => router.navigate('/room')}
      />
      <PreviewPanel
        snapshot={snapshot}
        health={health}
        permissions={permissions}
        camera={config.camera}
        onRequestPermissions={actions.requestPermissions}
      />
      <HealthLine view={line} onPress={() => router.navigate('/debug')} />
      <Controls snapshot={snapshot} actions={actions} />
    </SafeAreaView>
  );
}
