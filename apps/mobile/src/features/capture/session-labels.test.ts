import { describe, expect, it } from '@jest/globals';

import { isCameraEditable } from './session-labels';

describe('isCameraEditable', () => {
  it('lets the camera change only between sessions', () => {
    expect(isCameraEditable('idle')).toBe(true);
    expect(isCameraEditable('ready')).toBe(true);
    expect(isCameraEditable('recording')).toBe(false);
    expect(isCameraEditable('paused')).toBe(false);
  });
});
