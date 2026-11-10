import { describe, expect, it } from '@jest/globals';

import { captureConfig, captureOverrides } from './capture-config';

describe('captureOverrides', () => {
  it('keeps the app overrides when no camera was picked', () =>
    expect(captureOverrides(undefined)).toBe(captureConfig));
  it('adds the picked camera', () =>
    expect(captureOverrides('back')).toEqual({ ...captureConfig, camera: { position: 'back' } }));
});
