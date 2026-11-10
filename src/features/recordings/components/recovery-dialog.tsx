import { View } from 'react-native';

import type { RecoveryReport } from '@modules/capture-core';

import { formatDuration, formatLoss, formatSessionTime, plural } from '@shared/format';
import { Button } from '@ui/button';
import { Dialog, StatTile } from '@ui/dialog';
import { Icon } from '@ui/icon';
import { Text } from '@ui/text';

import { PLAYABLE } from '../recording-labels';

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
  const lastPlayable = report.segments.findLast((segment) => PLAYABLE.has(segment.state));
  const unplayable = report.segments.filter((segment) => segment.state === 'unplayable').length;
  return (
    <Dialog>
      <View className="flex-row gap-2.5">
        <Icon name="history" className="size-5.5" tint="accent-accent" />
        <View className="flex-1 gap-1">
          <Text variant="headline" className="text-foreground">
            Unfinished recording · {formatSessionTime(report.createdAt)}
          </Text>
          <Text variant="callout" className="text-subtle">
            The app was closed while recording.{' '}
            {lastPlayable ? 'What was on disk is playable.' : 'Nothing on disk could be opened.'}
          </Text>
          {unplayable > 0 && lastPlayable && (
            <Text variant="footnote" className="text-danger">
              {plural(unplayable, 'segment')} could not be opened.
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
          disabled={!lastPlayable}
          className="flex-1"
          onPress={() => lastPlayable && onPlay(report.sessionId, lastPlayable.index)}
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
