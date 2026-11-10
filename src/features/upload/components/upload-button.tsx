import { ActionButton } from '../../capture/components/action-button';
import type { UploadStatus } from '../use-uploads';

export function UploadButton({ status, onUpload }: { status: UploadStatus; onUpload: () => void }) {
  if (status.pending.length > 0) {
    return (
      <ActionButton
        title="Upload"
        variant="upload"
        size="compact"
        onPress={onUpload}
        style={{ flex: 1 }}
      />
    );
  }
  if (!status.uploading && !status.verified) return null;
  return (
    <ActionButton
      title={status.uploading ? 'Uploading…' : 'Uploaded'}
      size="compact"
      disabled
      style={{ flex: 1 }}
    />
  );
}
