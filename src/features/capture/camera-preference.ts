import type { CameraPosition } from '@modules/capture-core';

import { storedPreference } from '@shared/stored-preference';

const CAMERA_POSITIONS = ['front', 'back'] as const satisfies readonly CameraPosition[];

export const cameraPreference = storedPreference('preferences.cameraPosition', CAMERA_POSITIONS);
