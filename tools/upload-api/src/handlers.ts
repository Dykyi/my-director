import type { ObjectStorage } from './s3';
import type { CompleteUploadInput, CreateUploadInput } from './validation';

export const PART_URL_TTL_SEC = 24 * 60 * 60;
const CONTENT_TYPE = 'video/quicktime';

export type Deps = {
  storage: ObjectStorage;
  now: () => Date;
};

export async function createUpload(input: CreateUploadInput, deps: Deps) {
  const uploadId = await deps.storage.createMultipartUpload(input.key, CONTENT_TYPE);
  const parts = await Promise.all(
    input.partMd5s.map(async (md5, index) => ({
      partNumber: index + 1,
      url: await deps.storage.presignPart(input.key, uploadId, index + 1, md5, PART_URL_TTL_SEC),
      headers: { 'Content-MD5': md5 },
    })),
  );
  return {
    uploadId,
    key: input.key,
    partSize: input.partSize,
    expiresAt: new Date(deps.now().getTime() + PART_URL_TTL_SEC * 1000).toISOString(),
    parts,
  };
}

export async function completeUpload(uploadId: string, input: CompleteUploadInput, deps: Deps) {
  try {
    await deps.storage.completeMultipartUpload(input.key, uploadId, input.parts);
  } catch (error) {
    if ((await deps.storage.head(input.key)) === null) throw error;
  }
  const stored = await deps.storage.head(input.key);
  if (stored?.size === input.size) {
    return { status: 200 as const, body: { verified: true, key: input.key, size: stored.size, etag: stored.etag } };
  }
  return { status: 422 as const, body: { verified: false, expected: input.size, actual: stored?.size ?? null } };
}
