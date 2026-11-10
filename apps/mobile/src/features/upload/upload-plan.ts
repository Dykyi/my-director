import type { UploadSnapshot } from '@modules/background-upload';
import type { RecordingSummary, SegmentSummary } from '@modules/capture-core';

import { isCompleteSegment } from '@features/recordings/recording-labels';

import { ACTIVE_UPLOAD, needsUpload, segmentObjectKey } from './upload-format';

export type UploadStatus = { pending: SegmentSummary[]; uploading: boolean; verified: boolean };
export type UploadStep = { segment: SegmentSummary; replaces?: UploadSnapshot };

export function upsertUpload(
  uploads: UploadSnapshot[],
  snapshot: UploadSnapshot,
): UploadSnapshot[] {
  return [snapshot, ...uploads.filter((upload) => upload.id !== snapshot.id)];
}

export function findUpload(
  uploads: UploadSnapshot[],
  objectKey: string,
): UploadSnapshot | undefined {
  return uploads.find((upload) => upload.objectKey === objectKey);
}

function segmentJobs(recording: RecordingSummary, uploads: UploadSnapshot[]) {
  return recording.segments.map((segment) => ({
    segment,
    upload: findUpload(uploads, segmentObjectKey(recording.sessionId, segment.index)),
  }));
}

export function recordingStatus(
  recording: RecordingSummary,
  uploads: UploadSnapshot[],
): UploadStatus {
  const closed = segmentJobs(recording, uploads).filter(({ segment }) =>
    isCompleteSegment(segment),
  );
  return {
    pending: closed.filter(({ upload }) => needsUpload(upload)).map(({ segment }) => segment),
    uploading: closed.some(({ upload }) => upload !== undefined && ACTIVE_UPLOAD.has(upload.phase)),
    verified: closed.some(({ upload }) => upload?.phase === 'verified'),
  };
}

export function verifiedKeys(recording: RecordingSummary, uploads: UploadSnapshot[]): string[] {
  return segmentJobs(recording, uploads)
    .filter(({ upload }) => upload?.phase === 'verified')
    .map(({ segment }) => segmentObjectKey(recording.sessionId, segment.index));
}

export function runningJobs(
  recording: RecordingSummary,
  uploads: UploadSnapshot[],
): UploadSnapshot[] {
  return segmentJobs(recording, uploads)
    .flatMap(({ upload }) => (upload ? [upload] : []))
    .filter((upload) => ACTIVE_UPLOAD.has(upload.phase));
}

export function uploadPlan(recording: RecordingSummary, uploads: UploadSnapshot[]): UploadStep[] {
  return segmentJobs(recording, uploads)
    .filter(({ segment, upload }) => isCompleteSegment(segment) && needsUpload(upload))
    .map(({ segment, upload }) =>
      upload?.phase === 'failed' ? { segment, replaces: upload } : { segment },
    );
}

export async function runUploadPlan(
  steps: UploadStep[],
  io: {
    cancelUpload: (id: string) => Promise<unknown>;
    startUpload: (step: UploadStep) => Promise<UploadSnapshot>;
    stopped: () => boolean;
    onSnapshot: (snapshot: UploadSnapshot) => void;
  },
): Promise<void> {
  for (const step of steps) {
    if (io.stopped()) return;
    if (step.replaces) await io.cancelUpload(step.replaces.id);
    io.onSnapshot(await io.startUpload(step));
  }
}
