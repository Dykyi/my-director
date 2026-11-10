import { Text, View } from 'react-native';

import type { UploadPhase, UploadSnapshot } from '@modules/background-upload';

import { ActionButton } from '../../capture/components/action-button';
import { colors, mono } from '../../capture/components/theme';
import { ACTIVE_UPLOAD, describeUpload, uploadProgress } from '../upload-format';
import type { UploadActions } from '../use-uploads';

const PHASE_COLOR: Record<UploadPhase, string> = {
  preparing: colors.accent,
  uploading: colors.accent,
  completing: colors.accent,
  verified: colors.level,
  failed: colors.recordingText,
  cancelled: colors.muted,
};

export function SegmentUpload({ upload, actions }: { upload: UploadSnapshot | undefined; actions: UploadActions }) {
  if (!upload) return null;
  const active = ACTIVE_UPLOAD.has(upload.phase);
  const retryable = upload.phase === 'failed' && upload.uploadId !== undefined;
  return (
    <View style={{ paddingBottom: 8, gap: 6 }}>
      <Text selectable style={[mono, { color: PHASE_COLOR[upload.phase] }]}>
        {describeUpload(upload)}
      </Text>
      {active && (
        <View style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.border }}>
          <View style={{ width: `${uploadProgress(upload) * 100}%`, height: 6, backgroundColor: colors.progress }} />
        </View>
      )}
      {upload.uploadId && (
        <Text selectable style={[mono, { fontSize: 10, color: colors.faint }]}>
          {upload.uploadId} {upload.objectKey}
        </Text>
      )}
      {(active || retryable) && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {retryable && <ActionButton title="Retry failed parts" size="compact" onPress={() => actions.retry(upload.id)} />}
          {active && <ActionButton title="Cancel" variant="ghost" size="compact" onPress={() => actions.cancel(upload.id)} />}
        </View>
      )}
    </View>
  );
}
