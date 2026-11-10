import { cva } from 'class-variance-authority';
import { View } from 'react-native';

import type { UploadSnapshot } from '@modules/background-upload';

import { Button } from '@ui/button';
import { Icon } from '@ui/icon';
import { Text } from '@ui/text';

import { ACTIVE_UPLOAD, describeUpload, uploadProgress } from '../upload-format';
import type { UploadActions } from '../use-uploads';

const PERCENT = 100;

const phaseText = cva('shrink', {
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
  upload,
  actions,
}: {
  upload: UploadSnapshot | undefined;
  actions: UploadActions;
}) {
  if (!upload) return null;
  const active = ACTIVE_UPLOAD.has(upload.phase);
  const retryable = upload.phase === 'failed' && upload.uploadId !== undefined;
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-1">
        {upload.phase === 'verified' && (
          <Icon name="check" className="size-3.5" tint="accent-success" />
        )}
        <Text selectable variant="mono-value" className={phaseText({ phase: upload.phase })}>
          {describeUpload(upload)}
        </Text>
      </View>
      {active && (
        <View className="h-1.5 overflow-hidden rounded-bar bg-border">
          <View
            className="h-1.5 rounded-bar bg-progress"
            style={{ width: `${Math.round(uploadProgress(upload) * PERCENT)}%` }}
          />
        </View>
      )}
      {upload.uploadId && (
        <Text selectable variant="mono-id" className="text-faint">
          {upload.uploadId} {upload.objectKey}
        </Text>
      )}
      {(active || retryable) && (
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
