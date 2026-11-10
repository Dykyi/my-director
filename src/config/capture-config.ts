import type { CameraPosition, CaptureConfigInput } from '@modules/capture-core';

export const captureConfig: CaptureConfigInput = {};

export function captureOverrides(cameraPosition: CameraPosition | undefined): CaptureConfigInput {
  return cameraPosition === undefined
    ? captureConfig
    : { ...captureConfig, camera: { ...captureConfig.camera, position: cameraPosition } };
}
