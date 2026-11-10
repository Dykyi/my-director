import type { UploadSnapshot } from '@modules/background-upload';

import { formatBytes } from '../capture/format';

export function segmentObjectKey(sessionId: string, segmentIndex: number): string {
  return `${sessionId}/segment-${String(segmentIndex).padStart(3, '0')}.mov`;
}

function retries(count: number): string {
  if (count === 0) return '';
  return ` · ${count} ${count === 1 ? 'retry' : 'retries'}`;
}

export function describeUpload(upload: UploadSnapshot): string {
  const retried = retries(upload.retries.length);
  switch (upload.phase) {
    case 'preparing':
      return 'preparing (slicing and MD5)';
    case 'uploading':
      return `uploading ${upload.partsDone}/${upload.partsTotal} · ${formatBytes(upload.bytesConfirmed)} of ${formatBytes(upload.bytesTotal)}${retried}`;
    case 'completing':
      return `completing · ${upload.partsTotal} parts${retried}`;
    case 'verified':
      return `verified · server ${formatBytes(upload.serverSize ?? 0)} · ${upload.partsTotal} parts${retried}`;
    case 'failed':
      return `failed · ${upload.error ?? 'unknown error'}${retried}`;
    case 'cancelled':
      return 'cancelled';
  }
}
