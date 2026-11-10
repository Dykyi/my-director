import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { BackgroundUpload, type UploadSnapshot } from '@modules/background-upload';
import type { SegmentSummary } from '@modules/capture-core';
import { uploadApi } from '@/src/config/env';

import { describeError } from '../capture/use-capture-session';
import { segmentObjectKey } from './upload-format';

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

  const reload = useCallback(() => BackgroundUpload.getUploads().then(setUploads, reportError), [reportError]);

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

  const uploadFor = useCallback((objectKey: string) => uploads.find((upload) => upload.objectKey === objectKey), [uploads]);

  const start = (sessionId: string, segment: SegmentSummary) =>
    guard(async () => {
      await BackgroundUpload.requestNotificationPermission();
      const snapshot = await BackgroundUpload.startUpload({
        fileUri: segment.uri,
        objectKey: segmentObjectKey(sessionId, segment.index),
        api: uploadApi(),
      });
      setUploads((current) => withSnapshot(current, snapshot));
    });

  const retry = (id: string) => guard(() => BackgroundUpload.retryFailedParts(id));
  const cancel = (id: string) => guard(() => BackgroundUpload.cancelUpload(id));

  return { error, uploadFor, actions: { start, retry, cancel } };
}

export type UploadActions = ReturnType<typeof useUploads>['actions'];
