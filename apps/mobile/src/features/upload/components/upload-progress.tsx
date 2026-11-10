import { cva } from 'class-variance-authority';
import { View } from 'react-native';

import type { UploadSnapshot } from '@modules/background-upload';

import { PERCENT } from '@shared/units';
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
}: {
  label: string;
  upload: UploadSnapshot | undefined;
  actions: UploadActions;
}) {
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
        {upload && (
          <View className="ml-auto pl-2">
            <CopyButton value={upload.objectKey} label="object key" />
          </View>
        )}
      </View>
      {upload && !verified && (
        <Text selectable variant="mono-value" className={phaseText({ phase: upload.phase })}>
          {describeUpload(upload)}
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
