import { cva } from 'class-variance-authority';
import { Pressable, View } from 'react-native';

import type { UploadSnapshot } from '@modules/background-upload';

import { PERCENT } from '@shared/units';
import { useReportedErrors } from '@shared/use-reported-errors';
import { Button } from '@ui/button';
import { CopyButton } from '@ui/copy-button';
import { Icon } from '@ui/icon';
import { Text } from '@ui/text';

import { ACTIVE_UPLOAD, describeUpload, uploadProgress } from '../upload-format';
import type { UploadActions } from '../use-native-uploads';

const phaseText = cva('', {
  variants: {
    phase: {
      preparing: 'text-accent',
      uploading: 'text-accent',
      completing: 'text-accent',
      verified: 'text-success',
      failed: 'text-danger',
      cancelled: 'text-muted',
    },
  },
});

export function UploadProgress({
  label,
  upload,
  actions,
  share,
}: {
  label: string;
  upload: UploadSnapshot | undefined;
  actions: UploadActions;
  share: () => Promise<void>;
}) {
  const row = useReportedErrors();
  const verified = upload?.phase === 'verified';
  const active = upload !== undefined && ACTIVE_UPLOAD.has(upload.phase);
  const retryable = upload?.phase === 'failed' && upload.uploadId !== undefined;
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-1.5">
        <Text selectable variant="mono-value" className="shrink text-subtle">
          {label}
        </Text>
        {verified && <Icon name="check" className="size-3.5" tint="accent-success" />}
        <View className="ml-auto flex-row items-center gap-4 pl-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share this segment"
            hitSlop={8}
            onPress={() => void row.guard(share)}
            className="active:opacity-60"
          >
            <Icon name="share" className="size-3.5" tint="accent-muted" />
          </Pressable>
          {verified && (
            <CopyButton
              copy={() => row.guard(() => actions.copyLink(upload.objectKey))}
              label="download link"
            />
          )}
        </View>
      </View>
      {upload && !verified && (
        <Text selectable variant="mono-value" className={phaseText({ phase: upload.phase })}>
          {describeUpload(upload)}
        </Text>
      )}
      {row.error && (
        <Text selectable variant="footnote" className="text-danger">
          {row.error}
        </Text>
      )}
      {active && (
        <View className="h-1.5 overflow-hidden rounded-bar bg-border">
          <View
            className="h-1.5 rounded-bar bg-progress"
            style={{ width: `${Math.round(uploadProgress(upload) * PERCENT)}%` }}
          />
        </View>
      )}
      {upload && (active || retryable) && (
        <View className="flex-row gap-2">
          {retryable && (
            <Button
              title="Retry failed parts"
              size="compact"
              onPress={() => actions.retry(upload.id)}
            />
          )}
          {active && (
            <Button
              title="Cancel"
              variant="ghost"
              size="compact"
              onPress={() => actions.cancel(upload.id)}
            />
          )}
        </View>
      )}
    </View>
  );
}
