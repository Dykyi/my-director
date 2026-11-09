import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildCompleteBody, parseListParts, parseUploadId, regionOf, S3Api } from '../src/s3';

const ENDPOINT = 'https://s3.eu-central-003.backblazeb2.com';
const BUCKET = 'mydirector-poc-4f2a';
const KEY = 's/segment-001.mov';
const api = new S3Api({ endpoint: ENDPOINT, bucket: BUCKET, accessKeyId: 'B2KEYIDEXAMPLE', secretAccessKey: 'secret' });

function stubB2(response: Response): Promise<Request> {
  return new Promise((resolve) => {
    vi.stubGlobal('fetch', async (request: Request) => {
      resolve(request);
      return response;
    });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('regionOf', () => {
  it('takes the signing region from the B2 endpoint', () => expect(regionOf(ENDPOINT)).toBe('eu-central-003'));
  it('rejects an endpoint that is not B2', () => expect(() => regionOf('https://example.com')).toThrow('Backblaze B2'));
});

describe('presignPart', () => {
  it('signs a PUT for one part with the MD5 header bound into the signature', async () => {
    const url = new URL(await api.presignPart(KEY, 'upload-1', 7, 'rL0Y20zC+Fzt72VPzMSk2A==', 86_400));
    expect(url.host).toBe('s3.eu-central-003.backblazeb2.com');
    expect(url.pathname).toBe(`/${BUCKET}/${KEY}`);
    expect(url.searchParams.get('partNumber')).toBe('7');
    expect(url.searchParams.get('uploadId')).toBe('upload-1');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('86400');
    expect(url.searchParams.get('X-Amz-Credential')).toMatch(/^B2KEYIDEXAMPLE\/\d{8}\/eu-central-003\/s3\/aws4_request$/);
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-md5');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('createMultipartUpload', () => {
  it('posts ?uploads with the content type and returns the UploadId', async () => {
    const sent = stubB2(
      new Response(`<?xml version="1.0" encoding="UTF-8"?>
        <InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
        <Bucket>${BUCKET}</Bucket><Key>${KEY}</Key><UploadId>4_z6145af89_f2025e1f_t0048</UploadId>
        </InitiateMultipartUploadResult>`),
    );
    await expect(api.createMultipartUpload(KEY, 'video/quicktime')).resolves.toBe('4_z6145af89_f2025e1f_t0048');
    const request = await sent;
    const url = new URL(request.url);
    expect(request.method).toBe('POST');
    expect(url.pathname).toBe(`/${BUCKET}/${KEY}`);
    expect(url.searchParams.has('uploads')).toBe(true);
    expect(request.headers.get('Content-Type')).toBe('video/quicktime');
    expect(request.headers.get('Authorization')).toContain('/eu-central-003/s3/aws4_request');
  });

  it('fails loudly when the answer has no UploadId', () => expect(() => parseUploadId('<Error/>')).toThrow('UploadId'));
});

describe('completeMultipartUpload', () => {
  it('posts the parts as S3 XML with quoted ETags', async () => {
    const sent = stubB2(new Response('<CompleteMultipartUploadResult/>'));
    await api.completeMultipartUpload(KEY, 'upload-1', [{ partNumber: 1, etag: '"a"' }, { partNumber: 2, etag: 'b' }]);
    const request = await sent;
    expect(request.method).toBe('POST');
    expect(new URL(request.url).searchParams.get('uploadId')).toBe('upload-1');
    expect(await request.text()).toBe(
      '<CompleteMultipartUpload xmlns="http://s3.amazonaws.com/doc/2006-03-01/">' +
        '<Part><PartNumber>1</PartNumber><ETag>"a"</ETag></Part>' +
        '<Part><PartNumber>2</PartNumber><ETag>"b"</ETag></Part>' +
        '</CompleteMultipartUpload>',
    );
  });

  it('escapes ETags, which come from the app', () =>
    expect(buildCompleteBody([{ partNumber: 1, etag: 'a</ETag><x>&' }])).toContain('<ETag>"a&lt;/ETag&gt;&lt;x&gt;&amp;"</ETag>'));

  it('puts the S3 error code into the error', async () => {
    void stubB2(new Response('<Error><Code>NoSuchUpload</Code></Error>', { status: 404 }));
    await expect(api.completeMultipartUpload(KEY, 'gone', [{ partNumber: 1, etag: 'a' }])).rejects.toThrow('HTTP 404: NoSuchUpload');
  });
});

describe('head', () => {
  it('maps HeadObject headers to the stored size and unquoted ETag', async () => {
    const sent = stubB2(new Response(null, { headers: { 'Content-Length': '482344960', ETag: '"3729bf569924c845dfe90bfe6281a9ff-29"' } }));
    await expect(api.head(KEY)).resolves.toEqual({ size: 482_344_960, etag: '3729bf569924c845dfe90bfe6281a9ff-29' });
    expect((await sent).method).toBe('HEAD');
  });

  it('reports a missing object as null', async () => {
    void stubB2(new Response(null, { status: 404 }));
    await expect(api.head(KEY)).resolves.toBeNull();
  });
});

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
