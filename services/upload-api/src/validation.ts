// B2 multipart limits: every part but the last at least 5 MB, at most 10 000 parts. 5 MiB keeps above 5 MB.
export const MIN_PART_SIZE = 5 * 1024 * 1024;
const MAX_PARTS = 10_000;

const SAFE_KEY = /^[A-Za-z0-9!_.*'()\-/]{1,512}$/;
const MD5_BASE64 = /^[A-Za-z0-9+/]{22}==$/;

export type CreateUploadInput = { key: string; size: number; partSize: number; partMd5s: string[] };
export type CompletedPart = { partNumber: number; etag: string };
export type CompleteUploadInput = { key: string; size: number; parts: CompletedPart[] };

export class InputError extends Error {}

type JsonObject = Record<string, unknown>;

export function asObject(body: unknown): JsonObject {
  if (typeof body !== 'object' || body === null) throw new InputError('body must be a JSON object');
  return body as JsonObject;
}

const isMd5Digest = (value: unknown): value is string =>
  typeof value === 'string' && MD5_BASE64.test(value);

export function parseKey(value: unknown): string {
  if (typeof value !== 'string' || !SAFE_KEY.test(value) || value.includes('..')) {
    throw new InputError('key is missing or has unsafe characters');
  }
  return value;
}

function parsePositiveInteger(name: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new InputError(`${name} must be a positive integer`);
  }
  return value;
}

export function parseCreate(body: unknown): CreateUploadInput {
  const fields = asObject(body);
  const size = parsePositiveInteger('size', fields.size);
  const partSize = parsePositiveInteger('partSize', fields.partSize);
  if (partSize < MIN_PART_SIZE) throw new InputError(`partSize must be at least ${MIN_PART_SIZE}`);
  const partCount = Math.ceil(size / partSize);
  if (partCount > MAX_PARTS)
    throw new InputError(`at most ${MAX_PARTS} parts are allowed, got ${partCount}`);
  const digests = fields.partMd5s;
  if (!Array.isArray(digests) || digests.length !== partCount || !digests.every(isMd5Digest)) {
    throw new InputError(`partMd5s must hold ${partCount} base64 MD5 digests`);
  }
  return { key: parseKey(fields.key), size, partSize, partMd5s: digests };
}

export function parseComplete(body: unknown): CompleteUploadInput {
  const fields = asObject(body);
  if (!Array.isArray(fields.parts) || fields.parts.length === 0)
    throw new InputError('parts must be a non-empty array');
  const parts = (fields.parts as unknown[])
    .map((part) => {
      const partFields = asObject(part);
      if (typeof partFields.etag !== 'string' || partFields.etag.length === 0)
        throw new InputError('every part needs an etag');
      return {
        partNumber: parsePositiveInteger('partNumber', partFields.partNumber),
        etag: partFields.etag,
      };
    })
    .sort((a, b) => a.partNumber - b.partNumber);
  if (!parts.every((part, index) => part.partNumber === index + 1)) {
    throw new InputError('parts must be numbered 1..n without gaps or duplicates');
  }
  return { key: parseKey(fields.key), size: parsePositiveInteger('size', fields.size), parts };
}
