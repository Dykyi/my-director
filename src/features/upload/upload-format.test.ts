import { describe, expect, it } from '@jest/globals';

import type { UploadSnapshot } from '@modules/background-upload';

import { describeUpload, segmentObjectKey } from './upload-format';

const upload = (overrides: Partial<UploadSnapshot>): UploadSnapshot => ({
  id: 'job',
  fileUri: 'file:///Recordings/s/segment-001.mov',
  objectKey: 's/segment-001.mov',
  phase: 'uploading',
  bytesTotal: 482_344_960,
  bytesConfirmed: 50_331_648,
  partsTotal: 29,
  partsDone: 3,
  retries: [],
  updatedAt: '2026-11-10T09:00:00.000Z',
  ...overrides,
});

describe('segmentObjectKey', () => {
  it('names the object like the file on the phone', () =>
    expect(segmentObjectKey('2026-11-10T09-12-33Z-4F2A', 1)).toBe('2026-11-10T09-12-33Z-4F2A/segment-001.mov'));
});

describe('describeUpload', () => {
  it('shows confirmed parts and bytes', () => expect(describeUpload(upload({}))).toBe('uploading 3/29 · 48.0 MB of 460.0 MB'));
  it('counts retries', () =>
    expect(describeUpload(upload({ retries: [{ partNumber: 7, attempt: 1, reason: 'offline', at: '' }] }))).toBe(
      'uploading 3/29 · 48.0 MB of 460.0 MB · 1 retry',
    ));
  it('shows the server size once verified', () =>
    expect(describeUpload(upload({ phase: 'verified', partsDone: 29, serverSize: 482_344_960 }))).toBe(
      'verified · server 460.0 MB · 29 parts',
    ));
  it('shows the failure', () =>
    expect(describeUpload(upload({ phase: 'failed', error: 'Part 3 rejected with HTTP 404' }))).toBe(
      'failed · Part 3 rejected with HTTP 404',
    ));
});
