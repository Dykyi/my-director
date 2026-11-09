import { describe, expect, it } from 'vitest';

import { InputError, MIN_PART_SIZE, parseComplete, parseCreate } from '../src/validation';

const MD5 = 'rL0Y20zC+Fzt72VPzMSk2A==';
const SIZE = 482_344_960;
const PART_SIZE = 16 * 1024 * 1024;
const PARTS = Math.ceil(SIZE / PART_SIZE);

describe('parseCreate', () => {
  const valid = { key: '2026-11-10T09-12-33Z-4F2A/segment-001.mov', size: SIZE, partSize: PART_SIZE, partMd5s: Array(PARTS).fill(MD5) };

  it('accepts a 460 MB file in 29 parts', () => expect(parseCreate(valid).partMd5s).toHaveLength(29));
  it('rejects parts smaller than 5 MiB', () =>
    expect(() => parseCreate({ ...valid, partSize: MIN_PART_SIZE - 1 })).toThrow(InputError));
  it('rejects a digest count that does not match the part count', () =>
    expect(() => parseCreate({ ...valid, partMd5s: [MD5] })).toThrow(InputError));
  it('rejects malformed digests', () =>
    expect(() => parseCreate({ ...valid, partMd5s: Array(PARTS).fill('abc') })).toThrow(InputError));
  it('rejects unsafe keys', () => expect(() => parseCreate({ ...valid, key: '../etc/passwd' })).toThrow(InputError));
  it('rejects more than 10 000 parts', () =>
    expect(() => parseCreate({ ...valid, size: MIN_PART_SIZE * 10_001, partSize: MIN_PART_SIZE, partMd5s: [] })).toThrow(InputError));
});

describe('parseComplete', () => {
  const valid = { key: 'a/segment-001.mov', size: 10, parts: [{ partNumber: 2, etag: 'b' }, { partNumber: 1, etag: 'a' }] };

  it('sorts parts by number', () => expect(parseComplete(valid).parts.map((part) => part.partNumber)).toEqual([1, 2]));
  it('rejects duplicate part numbers', () =>
    expect(() => parseComplete({ ...valid, parts: [{ partNumber: 1, etag: 'a' }, { partNumber: 1, etag: 'b' }] })).toThrow(InputError));
  it('rejects a gap in part numbers', () =>
    expect(() => parseComplete({ ...valid, parts: [{ partNumber: 1, etag: 'a' }, { partNumber: 3, etag: 'c' }] })).toThrow(InputError));
});
