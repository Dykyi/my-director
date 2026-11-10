import type { UploadPhase, UploadSnapshot } from '@modules/background-upload';

import { formatBytes } from '../capture/format';
import { plural } from '../capture/session-labels';

const RESTARTABLE: ReadonlySet<UploadPhase> = new Set(['failed', 'cancelled']);
export const ACTIVE_UPLOAD: ReadonlySet<UploadPhase> = new Set([
  'preparing',
  'uploading',
  'completing',
]);

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
      return `completing · ${plural(upload.partsTotal, 'part')}${retried}`;
    case 'verified':
      return `verified · server ${formatBytes(upload.serverSize ?? 0)} · ${plural(upload.partsTotal, 'part')}${retried}`;
    case 'failed':
      return `failed · ${upload.error ?? 'unknown error'}${retried}`;
    case 'cancelled':
      return 'cancelled';
  }
}

export function needsUpload(upload: UploadSnapshot | undefined): boolean {
  return !upload || RESTARTABLE.has(upload.phase);
}

export function uploadProgress({ bytesConfirmed, bytesTotal }: UploadSnapshot): number {
  return bytesTotal > 0 ? bytesConfirmed / bytesTotal : 0;
}
