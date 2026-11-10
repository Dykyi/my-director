import { isNoSuchUpload, type ObjectStorage } from './storage.ts';
import type { CompleteUploadInput, CreateUploadInput } from './validation.ts';

// A 460 MB upload takes minutes, and an expired URL fails visibly with 403.
export const PART_URL_TTL_SEC = 24 * 60 * 60;
const SEGMENT_CONTENT_TYPE = 'video/quicktime';

export type Dependencies = {
  storage: ObjectStorage;
  now: () => Date;
};

export async function createUpload(input: CreateUploadInput, { storage, now }: Dependencies) {
  const uploadId = await storage.createMultipartUpload(input.key, SEGMENT_CONTENT_TYPE);
  const parts = await Promise.all(
    input.partMd5s.map(async (md5, index) => ({
      partNumber: index + 1,
      url: await storage.presignPart(input.key, uploadId, index + 1, md5, PART_URL_TTL_SEC),
      headers: { 'Content-MD5': md5 },
    })),
  );
  return {
    uploadId,
    key: input.key,
    partSize: input.partSize,
    expiresAt: new Date(now().getTime() + PART_URL_TTL_SEC * 1000).toISOString(),
    parts,
  };
}

export async function completeUpload(
  uploadId: string,
  input: CompleteUploadInput,
  { storage }: Dependencies,
) {
  try {
    await storage.completeMultipartUpload(input.key, uploadId, input.parts);
  } catch (error) {
    // A retry after a lost response finds the upload already completed; then the stored object decides.
    if (!isNoSuchUpload(error) || (await storage.headObject(input.key)) === null) throw error;
  }
  const stored = await storage.headObject(input.key);
  if (stored?.size === input.size) {
    return {
      status: 200 as const,
      body: { verified: true, key: input.key, size: stored.size, etag: stored.etag },
    };
  }
  return {
    status: 422 as const,
    body: { verified: false, expected: input.size, actual: stored?.size ?? null },
  };
}
