import { View } from 'react-native';

import type { RecoveryReport } from '@modules/capture-core';

import { formatDuration, formatLoss, formatSessionTime } from '@shared/format';
import { Button } from '@ui/button';
import { Dialog } from '@ui/dialog';
import { Icon } from '@ui/icon';
import { StatTile } from '@ui/stat-tile';
import { Text } from '@ui/text';

import { recoveryView } from '../recording-labels';

export function RecoveryDialog({
  report,
  note,
  onPlay,
  onVerify,
  onDismiss,
}: {
  report: RecoveryReport | undefined;
  note: string;
  onPlay: (sessionId: string, segment: number) => void;
  onVerify: (sessionId: string) => void;
  onDismiss: (sessionId: string) => void;
}) {
  if (!report) return null;
  const { lastPlayable, summary, unplayableNote } = recoveryView(report);
  return (
    <Dialog>
      <View className="flex-row gap-2.5">
        <Icon name="history" className="size-5.5" tint="accent-accent" />
        <View className="flex-1 gap-1">
          <Text variant="headline" className="text-foreground">
            Unfinished recording · {formatSessionTime(report.createdAt)}
          </Text>
          <Text variant="callout" className="text-subtle">
            {summary}
          </Text>
          {unplayableNote && (
            <Text variant="footnote" className="text-danger">
              {unplayableNote}
            </Text>
          )}
        </View>
      </View>
      <View className="flex-row gap-2">
        <StatTile label="Recovered" value={formatDuration(report.recoveredSec)} />
        <StatTile label="Lost" value={formatLoss(report)} />
        <StatTile label="Segments" value={String(report.segments.length)} />
      </View>
      <Text variant="footnote" className="text-muted">
        {note}
      </Text>
      <View className="flex-row gap-2">
        <Button
          title="Play"
          variant="primary"
          disabled={lastPlayable === undefined}
          className="flex-1"
          onPress={() => lastPlayable !== undefined && onPlay(report.sessionId, lastPlayable)}
        />
        <Button title="Verify" className="flex-1" onPress={() => onVerify(report.sessionId)} />
        <Button
          title="Dismiss"
          variant="ghost"
          className="flex-1"
          onPress={() => onDismiss(report.sessionId)}
        />
      </View>
    </Dialog>
  );
}
