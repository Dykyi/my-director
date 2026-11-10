import type { CameraPosition, CaptureConfigInput } from '@modules/capture-core';

/** Only what differs from the native defaults; `prepare` rejects unknown keys and wrong types. */
export const captureConfig: CaptureConfigInput = {};

export function captureOverrides(cameraPosition: CameraPosition | undefined): CaptureConfigInput {
  return cameraPosition === undefined
    ? captureConfig
    : { ...captureConfig, camera: { ...captureConfig.camera, position: cameraPosition } };
}
