import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { RecordingSummary, SegmentSummary } from '@modules/capture-core';

import type { UploadStatus } from '@features/upload/upload-plan';
import { formatSessionTime } from '@shared/format';
import { Button } from '@ui/button';
import { Chip } from '@ui/chip';
import type { IconName } from '@ui/icons';
import { Text } from '@ui/text';

import {
  cardActions,
  recordingChip,
  recordingMeta,
  recoveredNote,
  type CardAction,
} from '../recording-labels';

const UPLOAD_NOTE =
  'Keeps going with the screen locked. Each 16 MB part is checked by MD5; done only when the server confirms.';

export type CardHandlers = Record<CardAction, (recording: RecordingSummary) => void>;

type ActionButton = {
  title: string;
  variant: 'raised' | 'upload' | 'ghost' | 'delete';
  icon?: IconName;
  iconOnly?: boolean;
};

const ACTION_BUTTON: Record<CardAction, ActionButton> = {
  play: { title: 'Play', variant: 'raised' },
  verify: { title: 'Verify', variant: 'raised' },
  upload: { title: 'Upload', variant: 'upload' },
  cancel: { title: 'Cancel', variant: 'ghost' },
  delete: { title: 'Delete recording', variant: 'delete', icon: 'trash', iconOnly: true },
};

export function RecordingCard({
  recording,
  status,
  isActive,
  handlers,
  renderSegment,
}: {
  recording: RecordingSummary;
  status: UploadStatus;
  isActive: boolean;
  handlers: CardHandlers;
  renderSegment: (segment: SegmentSummary) => ReactNode;
}) {
  const chip = recordingChip(recording, status);
  return (
    <View className="gap-2.5 rounded-lg border border-border border-continuous bg-surface p-3.5">
      <View className="flex-row items-start gap-2">
        <View className="flex-1 gap-0.5">
          <Text variant="card-title" className="text-foreground">
            {formatSessionTime(recording.createdAt)}
          </Text>
          <Text selectable variant="mono-value" className="text-muted">
            {recordingMeta(recording)}
          </Text>
        </View>
        <Chip label={chip.label} tone={chip.tone} />
      </View>
      {recording.state === 'recovered' && (
        <Text variant="footnote" className="text-subtle">
          {recoveredNote(recording)}
        </Text>
      )}
      <View className="gap-2">{recording.segments.map(renderSegment)}</View>
      {status.uploading && (
        <Text variant="caption" className="text-muted">
          {UPLOAD_NOTE}
        </Text>
      )}
      <View className="flex-row gap-2">
        {cardActions(status, isActive).map((action) => {
          const { iconOnly, ...button } = ACTION_BUTTON[action];
          return (
            <Button
              key={action}
              {...button}
              iconOnly={iconOnly}
              size="compact"
              className={iconOnly ? undefined : 'flex-1'}
              onPress={() => handlers[action](recording)}
            />
          );
        })}
      </View>
    </View>
  );
}
