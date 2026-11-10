import type { CameraPosition } from '@modules/capture-core';

import { storedPreference } from '@shared/stored-preference';

export const CAMERA_POSITIONS = ['front', 'back'] as const satisfies readonly CameraPosition[];

export const CAMERA_LABEL: Record<CameraPosition, string> = { front: 'Front', back: 'Back' };

export const cameraPreference = storedPreference('preferences.cameraPosition', CAMERA_POSITIONS);
