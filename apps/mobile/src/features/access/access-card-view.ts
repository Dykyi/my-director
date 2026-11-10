import type { PermissionsState, PermissionStatus } from '@modules/capture-core';

import type { IconName } from '@ui/icons';

export const NOTICES_ANSWERS = ['asked', 'skipped'] as const;
export type NoticesAnswer = (typeof NOTICES_ANSWERS)[number];

export type AccessAction = 'ask' | 'openSettings' | 'allowNotices' | 'skipNotices';
type AccessTone = 'muted' | 'accent' | 'success' | 'danger';

interface AccessRow {
  icon: IconName;
  label: string;
  status: string;
  tone: AccessTone;
}

interface AccessButton {
  title: string;
  action: AccessAction;
}

export interface AccessCardView {
  title: string;
  body: string;
  rows: AccessRow[];
  primary: AccessButton;
  secondary?: AccessButton;
}

const MEDIA_ROW = {
  camera: { icon: 'camera', label: 'Camera' },
  microphone: { icon: 'mic', label: 'Microphone' },
} as const satisfies Record<keyof PermissionsState, { icon: IconName; label: string }>;

const COME_BACK = 'then come back: this screen updates by itself.';

const TURNED_OFF = {
  camera: {
    title: 'Camera is off',
    body: `MyDirector needs the camera to film your interview. Turn it on in Settings, ${COME_BACK}`,
  },
  microphone: {
    title: 'Microphone is off',
    body: `MyDirector needs the microphone to record your answers. Turn it on in Settings, ${COME_BACK}`,
  },
  both: {
    title: 'Camera and microphone are off',
    body: `MyDirector needs the camera and the microphone to record your interview. Turn them on in Settings, ${COME_BACK}`,
  },
};

const MEDIA_STATUS: Record<PermissionStatus, Pick<AccessRow, 'status' | 'tone'>> = {
  undetermined: { status: 'next', tone: 'muted' },
  granted: { status: 'allowed', tone: 'success' },
  denied: { status: 'off', tone: 'danger' },
};

const NOTICES_STATUS = {
  optional: { status: 'optional', tone: 'muted' },
  asking: { status: 'asking', tone: 'accent' },
} as const;

const INTRO =
  'MyDirector records your interview on this iPhone and shows you to the interviewer live. iOS asks for each one in turn.';

function accessRows(
  media: PermissionsState,
  notices: NoticesAnswer | undefined,
  asking: boolean,
): AccessRow[] {
  const mediaRows = (['camera', 'microphone'] as const).map((medium) => ({
    icon: MEDIA_ROW[medium].icon,
    label: MEDIA_ROW[medium].label,
    ...MEDIA_STATUS[media[medium]],
  }));
  if (notices) return mediaRows;
  const status = NOTICES_STATUS[asking ? 'asking' : 'optional'];
  return [...mediaRows, { icon: 'bell', label: 'Upload notices', ...status }];
}

function turnedOff({ camera, microphone }: PermissionsState): keyof typeof TURNED_OFF | undefined {
  if (camera === 'denied') return microphone === 'denied' ? 'both' : 'camera';
  return microphone === 'denied' ? 'microphone' : undefined;
}

export function accessCard(
  media: PermissionsState,
  notices: NoticesAnswer | undefined,
): AccessCardView | null {
  const off = turnedOff(media);
  if (off) {
    return {
      ...TURNED_OFF[off],
      rows: accessRows(media, notices, false),
      primary: { title: 'Open Settings', action: 'openSettings' },
    };
  }
  if (media.camera !== 'granted' || media.microphone !== 'granted') {
    return {
      title: 'Camera and microphone',
      body: INTRO,
      rows: accessRows(media, notices, false),
      primary: { title: 'Continue', action: 'ask' },
    };
  }
  if (notices) return null;
  return {
    title: 'Tell you when an upload finishes?',
    body: 'Uploads keep going while the phone is locked. iOS can show a notice on the lock screen when one is done.',
    rows: accessRows(media, notices, true),
    primary: { title: 'Allow notices', action: 'allowNotices' },
    secondary: { title: 'Not now', action: 'skipNotices' },
  };
}
