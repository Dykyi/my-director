import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { BackgroundUpload, type UploadSnapshot } from '@modules/background-upload';
import type { RecordingSummary, SegmentState, SegmentSummary } from '@modules/capture-core';

import { uploadApi } from '@config/env';
import { describeError } from '@features/capture/use-capture-session';

import { ACTIVE_UPLOAD, needsUpload, segmentObjectKey } from './upload-format';

const UPLOADABLE: ReadonlySet<SegmentState> = new Set(['finalized', 'recovered']);

export type UploadStatus = { pending: SegmentSummary[]; uploading: boolean; verified: boolean };

function withSnapshot(current: UploadSnapshot[], snapshot: UploadSnapshot): UploadSnapshot[] {
  return [snapshot, ...current.filter((upload) => upload.id !== snapshot.id)];
}

export function useUploads() {
  const [uploads, setUploads] = useState<UploadSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reportError = useCallback((caught: unknown) => setError(describeError(caught)), []);

  const guard = useCallback(
    async (action: () => Promise<void>) => {
      setError(null);
      try {
        await action();
      } catch (caught) {
        reportError(caught);
      }
    },
    [reportError],
  );

  const reload = useCallback(
    () => BackgroundUpload.getUploads().then(setUploads, reportError),
    [reportError],
  );

  useEffect(() => {
    const subscriptions = [
      BackgroundUpload.addListener('onUploadChange', (snapshot) =>
        setUploads((current) => withSnapshot(current, snapshot)),
      ),
      AppState.addEventListener('change', (state) => {
        if (state === 'active') void reload();
      }),
    ];
    void reload();
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [reload]);

  const uploadFor = useCallback(
    (objectKey: string) => uploads.find((upload) => upload.objectKey === objectKey),
    [uploads],
  );

  const uploadStatus = useCallback(
    (recording: RecordingSummary): UploadStatus => {
      const segments = recording.segments.filter((segment) => UPLOADABLE.has(segment.state));
      const jobs = segments.map((segment) =>
        uploadFor(segmentObjectKey(recording.sessionId, segment.index)),
      );
      return {
        pending: segments.filter((_, index) => needsUpload(jobs[index])),
        uploading: jobs.some((job) => job !== undefined && ACTIVE_UPLOAD.has(job.phase)),
        verified: jobs.some((job) => job?.phase === 'verified'),
      };
    },
    [uploadFor],
  );

  const startRecording = (recording: RecordingSummary) =>
    guard(async () => {
      await BackgroundUpload.requestNotificationPermission();
      for (const segment of uploadStatus(recording).pending) {
        const snapshot = await BackgroundUpload.startUpload({
          fileUri: segment.uri,
          objectKey: segmentObjectKey(recording.sessionId, segment.index),
          api: uploadApi,
        });
        setUploads((current) => withSnapshot(current, snapshot));
      }
    });

  const retry = (id: string) => guard(() => BackgroundUpload.retryFailedParts(id));
  const cancel = (id: string) => guard(() => BackgroundUpload.cancelUpload(id));

  return { error, uploadFor, uploadStatus, actions: { startRecording, retry, cancel } };
}

export type UploadActions = ReturnType<typeof useUploads>['actions'];
