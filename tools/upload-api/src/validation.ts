export const MIN_PART_SIZE = 5 * 1024 * 1024;
export const MAX_PARTS = 10_000;

const SAFE_KEY = /^[A-Za-z0-9!_.*'()\-/]{1,512}$/;
const MD5_BASE64 = /^[A-Za-z0-9+/]{22}==$/;

export type CreateUploadInput = { key: string; size: number; partSize: number; partMd5s: string[] };
export type CompletedPart = { partNumber: number; etag: string };
export type CompleteUploadInput = { key: string; size: number; parts: CompletedPart[] };

export class InputError extends Error {}

type Fields = Record<string, unknown>;

function asFields(body: unknown): Fields {
  if (typeof body !== 'object' || body === null) throw new InputError('body must be a JSON object');
  return body as Fields;
}

function key(value: unknown): string {
  if (typeof value !== 'string' || !SAFE_KEY.test(value) || value.includes('..')) {
    throw new InputError('key is missing or has unsafe characters');
  }
  return value;
}

function positiveInteger(name: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new InputError(`${name} must be a positive integer`);
  }
  return value;
}

export function parseCreate(body: unknown): CreateUploadInput {
  const fields = asFields(body);
  const size = positiveInteger('size', fields.size);
  const partSize = positiveInteger('partSize', fields.partSize);
  if (partSize < MIN_PART_SIZE) throw new InputError(`partSize must be at least ${MIN_PART_SIZE}`);
  const partCount = Math.ceil(size / partSize);
  if (partCount > MAX_PARTS)
    throw new InputError(`at most ${MAX_PARTS} parts are allowed, got ${partCount}`);
  const digests = fields.partMd5s;
  if (
    !Array.isArray(digests) ||
    digests.length !== partCount ||
    !digests.every((d) => typeof d === 'string' && MD5_BASE64.test(d))
  ) {
    throw new InputError(`partMd5s must hold ${partCount} base64 MD5 digests`);
  }
  return { key: key(fields.key), size, partSize, partMd5s: digests as string[] };
}

export function parseComplete(body: unknown): CompleteUploadInput {
  const fields = asFields(body);
  if (!Array.isArray(fields.parts) || fields.parts.length === 0)
    throw new InputError('parts must be a non-empty array');
  const parts = (fields.parts as unknown[])
    .map((part) => {
      const partFields = asFields(part);
      if (typeof partFields.etag !== 'string' || partFields.etag.length === 0)
        throw new InputError('every part needs an etag');
      return {
        partNumber: positiveInteger('partNumber', partFields.partNumber),
        etag: partFields.etag,
      };
    })
    .sort((a, b) => a.partNumber - b.partNumber);
  if (!parts.every((part, index) => part.partNumber === index + 1)) {
    throw new InputError('parts must be numbered 1..n without gaps or duplicates');
  }
  return { key: key(fields.key), size: positiveInteger('size', fields.size), parts };
}
