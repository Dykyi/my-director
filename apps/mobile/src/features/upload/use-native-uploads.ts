import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { BackgroundUpload, type UploadSnapshot } from '@modules/background-upload';
import type { RecordingSummary } from '@modules/capture-core';

import { uploadApi } from '@config/env';
import { useReportedErrors } from '@shared/use-reported-errors';

import { deleteFromBucket } from './bucket';
import { segmentObjectKey } from './upload-format';
import {
  findUpload,
  recordingStatus,
  runningJobs,
  runUploadPlan,
  uploadPlan,
  upsertUpload,
  verifiedKeys,
} from './upload-plan';

export function useNativeUploads() {
  const [uploads, setUploads] = useState<UploadSnapshot[]>([]);
  const { error, reportError, guard } = useReportedErrors();
  const cancelledSessions = useRef(new Set<string>());

  const reload = useCallback(
    () => BackgroundUpload.getUploads().then(setUploads, reportError),
    [reportError],
  );

  // Events sent while JS sleeps in the background never reach it, so the jobs are reread on every return.
  useEffect(() => {
    const subscriptions = [
      BackgroundUpload.addListener('onUploadChange', (snapshot) =>
        setUploads((current) => upsertUpload(current, snapshot)),
      ),
      AppState.addEventListener('change', (state) => {
        if (state === 'active') void reload();
      }),
    ];
    void reload();
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [reload]);

  const uploadFor = useCallback((objectKey: string) => findUpload(uploads, objectKey), [uploads]);
  const uploadStatus = useCallback(
    (recording: RecordingSummary) => recordingStatus(recording, uploads),
    [uploads],
  );
  const keysInBucket = useCallback(
    (recording: RecordingSummary) => verifiedKeys(recording, uploads),
    [uploads],
  );

  const startRecording = (recording: RecordingSummary) =>
    guard(async () => {
      cancelledSessions.current.delete(recording.sessionId);
      await runUploadPlan(uploadPlan(recording, uploads), {
        cancelUpload: (id) => BackgroundUpload.cancelUpload(id),
        startUpload: ({ segment }) =>
          BackgroundUpload.startUpload({
            fileUri: segment.uri,
            objectKey: segmentObjectKey(recording.sessionId, segment.index),
            api: uploadApi,
          }),
        stopped: () => cancelledSessions.current.has(recording.sessionId),
        onSnapshot: (snapshot) => setUploads((current) => upsertUpload(current, snapshot)),
      });
    });

  const retry = (id: string) => guard(() => BackgroundUpload.retryFailedParts(id));
  const cancel = (id: string) => guard(() => BackgroundUpload.cancelUpload(id));

  const cancelRecording = (recording: RecordingSummary) =>
    guard(async () => {
      cancelledSessions.current.add(recording.sessionId);
      for (const job of runningJobs(recording, uploads))
        await BackgroundUpload.cancelUpload(job.id);
    });

  const removeFromBucket = (recording: RecordingSummary) =>
    guard(async () => {
      for (const key of keysInBucket(recording)) await deleteFromBucket(uploadApi, key);
    });

  return {
    error,
    uploadFor,
    uploadStatus,
    keysInBucket,
    actions: { startRecording, retry, cancel, cancelRecording, removeFromBucket },
  };
}

export type UploadActions = ReturnType<typeof useNativeUploads>['actions'];
