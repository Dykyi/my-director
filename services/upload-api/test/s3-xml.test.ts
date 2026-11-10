import { describe, expect, it } from 'vitest';

import { parseListParts, parseVersionIds } from '../src/s3-xml';
import { KEY, VERSIONS } from './b2-fixtures';

describe('parseListParts', () => {
  it('reads part numbers, sizes and unquoted ETags', () => {
    const xml = `<ListPartsResult><Part><ETag>"abc"</ETag><LastModified>2026-11-10T09:00:00.000Z</LastModified>
      <PartNumber>1</PartNumber><Size>16777216</Size></Part><Part><ETag>&quot;def&quot;</ETag>
      <LastModified>2026-11-10T09:00:05.000Z</LastModified><PartNumber>2</PartNumber><Size>5</Size></Part></ListPartsResult>`;
    expect(parseListParts(xml)).toEqual([
      { partNumber: 1, etag: 'abc', size: 16_777_216, uploadedAt: '2026-11-10T09:00:00.000Z' },
      { partNumber: 2, etag: 'def', size: 5, uploadedAt: '2026-11-10T09:00:05.000Z' },
    ]);
  });
});

describe('parseVersionIds', () => {
  it('takes every version and delete marker of exactly this key', () =>
    expect(parseVersionIds(VERSIONS, KEY)).toEqual(['v2', 'm1', 'v1']));
});
