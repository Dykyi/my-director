import { describe, expect, it } from '@jest/globals';

import type { PermissionsState } from '@modules/capture-core';

import { accessCard } from './access-card-view';

const UNASKED: PermissionsState = { camera: 'undetermined', microphone: 'undetermined' };
const ALLOWED: PermissionsState = { camera: 'granted', microphone: 'granted' };

const statuses = (media: PermissionsState, notices?: 'asked' | 'skipped') =>
  accessCard(media, notices)?.rows.map((row) => row.status);

describe('accessCard', () => {
  it('asks for the camera and the microphone first, upload notices after them', () => {
    const card = accessCard(UNASKED, undefined);
    expect(card?.title).toBe('Camera and microphone');
    expect(card?.primary).toEqual({ title: 'Continue', action: 'ask' });
    expect(card?.secondary).toBeUndefined();
    expect(statuses(UNASKED)).toEqual(['next', 'next', 'optional']);
  });

  it('offers upload notices once the camera and the microphone are allowed', () => {
    const card = accessCard(ALLOWED, undefined);
    expect(card?.title).toBe('Tell you when an upload finishes?');
    expect(card?.primary.action).toBe('allowNotices');
    expect(card?.secondary?.action).toBe('skipNotices');
    expect(statuses(ALLOWED)).toEqual(['allowed', 'allowed', 'asking']);
  });

  it('goes away after either answer on upload notices', () => {
    expect(accessCard(ALLOWED, 'asked')).toBeNull();
    expect(accessCard(ALLOWED, 'skipped')).toBeNull();
  });

  it('names what is off and leads to Settings', () => {
    const micOff = accessCard({ camera: 'granted', microphone: 'denied' }, undefined);
    expect(micOff?.title).toBe('Microphone is off');
    expect(micOff?.body).toContain('the microphone to record your answers. Turn it on in Settings');
    expect(micOff?.primary).toEqual({ title: 'Open Settings', action: 'openSettings' });

    const bothOff = accessCard({ camera: 'denied', microphone: 'denied' }, undefined);
    expect(bothOff?.title).toBe('Camera and microphone are off');
    expect(bothOff?.body).toContain('Turn them on in Settings');
  });

  it('blocks on a turned-off camera even before the microphone is asked', () => {
    expect(accessCard({ camera: 'denied', microphone: 'undetermined' }, undefined)?.title).toBe(
      'Camera is off',
    );
  });

  it('leaves out upload notices once they are answered', () => {
    expect(statuses({ camera: 'denied', microphone: 'granted' }, 'skipped')).toEqual([
      'off',
      'allowed',
    ]);
  });
});
