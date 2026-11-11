import { router } from 'expo-router';

import { AccessCard } from '@features/access/components/access-card';
import { lastCallTarget } from '@features/call/call-target';
import { formatTimer } from '@shared/format';
import { SafeAreaView } from '@ui/styled';

import { roomName } from './call-labels';
import { useCaptureSession, useHealth, useSessionIssues } from './capture-session-context';
import { CallRow } from './components/call-row';
import { Controls } from './components/controls';
import { HealthLine } from './components/health-line';
import { PreviewPanel } from './components/preview-panel';
import { RecordHeader } from './components/record-header';
import { RecordNotices } from './components/record-notices';
import { callRowView, headerFact, recordNotices } from './record-views';
import { healthLine, WAITING_FOR_ACCESS } from './session-issues';
import { PHASE_PILL } from './session-labels';

export function RecordScreen() {
  const { snapshot, config, access, commandError, actions } = useCaptureSession();
  const health = useHealth();
  const issues = useSessionIssues('stretch');
  const line = access.ready ? healthLine(issues, snapshot) : WAITING_FOR_ACCESS;
  const room = roomName(snapshot.call, lastCallTarget.use()?.room);
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <RecordHeader
        pill={PHASE_PILL[snapshot.phase]}
        time={formatTimer(snapshot.recordedSec)}
        live={snapshot.phase === 'recording'}
        fact={headerFact(snapshot, health, config.recording)}
      />
      <RecordNotices
        view={recordNotices(snapshot, commandError)}
        onDismiss={actions.dismissError}
      />
      <CallRow
        view={callRowView(snapshot, config.call.profiles, room)}
        onPress={() => router.navigate('/room')}
      />
      <PreviewPanel
        snapshot={snapshot}
        health={health}
        camera={config.camera}
        accessCard={access.card && <AccessCard card={access.card} onAction={access.perform} />}
      />
      <HealthLine view={line} onPress={() => router.navigate('/debug')} />
      <Controls snapshot={snapshot} actions={actions} accessReady={access.ready} />
    </SafeAreaView>
  );
}
