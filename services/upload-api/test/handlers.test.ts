import { describe, expect, it, vi } from 'vitest';

import { completeUpload, createUpload, PART_URL_TTL_SEC, type Dependencies } from '../src/handlers';
import { S3Error } from '../src/storage';

const NOW = new Date('2026-11-10T09:00:00.000Z');
const MD5 = 'rL0Y20zC+Fzt72VPzMSk2A==';

function deps(overrides: { size?: number | null; completeError?: Error } = {}) {
  const size = overrides.size === undefined ? 30 : overrides.size;
  const storage = {
    createMultipartUpload: vi.fn(async () => 'upload-1'),
    presignPart: vi.fn(
      async (_key: string, _uploadId: string, partNumber: number) => `https://signed/${partNumber}`,
    ),
    completeMultipartUpload: vi.fn(async () => {
      if (overrides.completeError) throw overrides.completeError;
    }),
    headObject: vi.fn(async () => (size === null ? null : { size, etag: 'final' })),
    listParts: vi.fn(async () => []),
    abortMultipartUpload: vi.fn(async () => {}),
    deleteObject: vi.fn(async () => {}),
  };
  return { storage, now: () => NOW } satisfies Dependencies;
}

describe('createUpload', () => {
  it('starts a QuickTime upload and returns one signed URL per part with the MD5 header to send', async () => {
    const context = deps();
    const result = await createUpload(
      { key: 'k', size: 30, partSize: 16, partMd5s: [MD5, MD5] },
      context,
    );
    expect(context.storage.createMultipartUpload).toHaveBeenCalledWith('k', 'video/quicktime');
    expect(result.uploadId).toBe('upload-1');
    expect(result.parts).toEqual([
      { partNumber: 1, url: 'https://signed/1', headers: { 'Content-MD5': MD5 } },
      { partNumber: 2, url: 'https://signed/2', headers: { 'Content-MD5': MD5 } },
    ]);
    expect(result.expiresAt).toBe(new Date(NOW.getTime() + PART_URL_TTL_SEC * 1000).toISOString());
  });
});

describe('completeUpload', () => {
  const input = {
    key: 'k',
    size: 30,
    parts: [
      { partNumber: 1, etag: '"a"' },
      { partNumber: 2, etag: 'b' },
    ],
  };

  it('verifies when the stored size matches', async () => {
    const context = deps();
    const result = await completeUpload('upload-1', input, context);
    expect(context.storage.completeMultipartUpload).toHaveBeenCalledWith(
      'k',
      'upload-1',
      input.parts,
    );
    expect(result).toEqual({
      status: 200,
      body: { verified: true, key: 'k', size: 30, etag: 'final' },
    });
  });

  it('refuses when the stored size differs', async () => {
    const result = await completeUpload('upload-1', input, deps({ size: 29 }));
    expect(result).toEqual({ status: 422, body: { verified: false, expected: 30, actual: 29 } });
  });

  it('verifies a repeated complete whose first response was lost', async () => {
    const result = await completeUpload(
      'upload-1',
      input,
      deps({ completeError: new S3Error('CompleteMultipartUpload', 404, 'NoSuchUpload') }),
    );
    expect(result.status).toBe(200);
  });

  it('rethrows any other failure, even when an object of that size exists', async () => {
    const invalidPart = new S3Error('CompleteMultipartUpload', 400, 'InvalidPart');
    await expect(
      completeUpload('upload-1', input, deps({ completeError: invalidPart })),
    ).rejects.toBe(invalidPart);
  });

  it('rethrows when completing failed and nothing was stored', async () => {
    await expect(
      completeUpload('upload-1', input, deps({ size: null, completeError: new Error('boom') })),
    ).rejects.toThrow('boom');
  });
});
