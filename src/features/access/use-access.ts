import { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { BackgroundUpload } from '@modules/background-upload';
import { CaptureCore, type PermissionsState } from '@modules/capture-core';

import { storedPreference } from '@shared/stored-preference';

import { accessCard, NOTICES_ANSWERS, type AccessAction } from './access-card-view';

const noticesAnswer = storedPreference('access.uploadNotices', NOTICES_ANSWERS);

export function useAccess() {
  const [media, setMedia] = useState<PermissionsState>(() => CaptureCore.getPermissions());
  const notices = noticesAnswer.use();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setMedia(CaptureCore.getPermissions());
    });
    return () => subscription.remove();
  }, []);

  const actions: Record<AccessAction, () => void> = {
    ask: () => void CaptureCore.requestPermissions().then(setMedia),
    openSettings: () => void Linking.openSettings(),
    allowNotices: () =>
      void BackgroundUpload.requestNotificationPermission()
        .catch(() => false)
        .then(() => noticesAnswer.set('asked')),
    skipNotices: () => noticesAnswer.set('skipped'),
  };
  const card = accessCard(media, notices);
  return { card, ready: card === null, act: (action: AccessAction) => actions[action]() };
}

export type Access = ReturnType<typeof useAccess>;
