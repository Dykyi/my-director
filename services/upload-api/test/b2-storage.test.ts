import { afterEach, describe, expect, it, vi } from 'vitest';

import { B2Storage, regionOf } from '../src/b2-storage';
import { buildCompleteBody, parseUploadId } from '../src/s3-xml';
import { S3Error } from '../src/storage';
import { KEY, VERSIONS } from './b2-fixtures';

const ENDPOINT = 'https://s3.eu-central-003.backblazeb2.com';
const BUCKET = 'mydirector-poc-4f2a';
const api = new B2Storage({
  endpoint: ENDPOINT,
  bucket: BUCKET,
  accessKeyId: 'B2KEYIDEXAMPLE',
  secretAccessKey: 'secret',
});

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
  it('takes the signing region from the B2 endpoint', () =>
    expect(regionOf(ENDPOINT)).toBe('eu-central-003'));
  it('rejects an endpoint that is not B2', () =>
    expect(() => regionOf('https://example.com')).toThrow('Backblaze B2'));
});

describe('presignPart', () => {
  it('signs a PUT for one part with the MD5 header bound into the signature', async () => {
    const url = new URL(
      await api.presignPart(KEY, 'upload-1', 7, 'rL0Y20zC+Fzt72VPzMSk2A==', 86_400),
    );
    expect(url.host).toBe('s3.eu-central-003.backblazeb2.com');
    expect(url.pathname).toBe(`/${BUCKET}/${KEY}`);
    expect(url.searchParams.get('partNumber')).toBe('7');
    expect(url.searchParams.get('uploadId')).toBe('upload-1');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('86400');
    expect(url.searchParams.get('X-Amz-Credential')).toMatch(
      /^B2KEYIDEXAMPLE\/\d{8}\/eu-central-003\/s3\/aws4_request$/,
    );
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
    await expect(api.createMultipartUpload(KEY, 'video/quicktime')).resolves.toBe(
      '4_z6145af89_f2025e1f_t0048',
    );
    const request = await sent;
    const url = new URL(request.url);
    expect(request.method).toBe('POST');
    expect(url.pathname).toBe(`/${BUCKET}/${KEY}`);
    expect(url.searchParams.has('uploads')).toBe(true);
    expect(request.headers.get('Content-Type')).toBe('video/quicktime');
    expect(request.headers.get('Authorization')).toContain('/eu-central-003/s3/aws4_request');
    expect(request.cache).toBe('no-store');
  });

  it('fails loudly when the answer has no UploadId', () =>
    expect(() => parseUploadId('<Error/>')).toThrow('UploadId'));
});

describe('completeMultipartUpload', () => {
  it('posts the parts as S3 XML with quoted ETags', async () => {
    const sent = stubB2(new Response('<CompleteMultipartUploadResult/>'));
    await api.completeMultipartUpload(KEY, 'upload-1', [
      { partNumber: 1, etag: '"a"' },
      { partNumber: 2, etag: 'b' },
    ]);
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
    expect(buildCompleteBody([{ partNumber: 1, etag: 'a</ETag><x>&' }])).toContain(
      '<ETag>"a&lt;/ETag&gt;&lt;x&gt;&amp;"</ETag>',
    ));

  it('puts the S3 error code into the error', async () => {
    void stubB2(new Response('<Error><Code>NoSuchUpload</Code></Error>', { status: 404 }));
    await expect(
      api.completeMultipartUpload(KEY, 'gone', [{ partNumber: 1, etag: 'a' }]),
    ).rejects.toThrow('HTTP 404: NoSuchUpload');
  });
});

describe('headObject', () => {
  it('maps HeadObject headers to the stored size and unquoted ETag', async () => {
    const sent = stubB2(
      new Response(null, {
        headers: { 'Content-Length': '482344960', ETag: '"3729bf569924c845dfe90bfe6281a9ff-29"' },
      }),
    );
    await expect(api.headObject(KEY)).resolves.toEqual({
      size: 482_344_960,
      etag: '3729bf569924c845dfe90bfe6281a9ff-29',
    });
    expect((await sent).method).toBe('HEAD');
  });

  it('throws the S3 error code for the caller to act on', async () => {
    void stubB2(
      new Response('<Error><Code>NoSuchUpload</Code></Error>', {
        status: 404,
        statusText: 'Not Found',
      }),
    );
    const failure = api.listParts(KEY, 'upload-1');
    await expect(failure).rejects.toBeInstanceOf(S3Error);
    await expect(failure).rejects.toMatchObject({ code: 'NoSuchUpload', status: 404 });
  });

  it('reports a missing object as null', async () => {
    void stubB2(new Response(null, { status: 404 }));
    await expect(api.headObject(KEY)).resolves.toBeNull();
  });

  it('bypasses the Cloudflare cache, which would send the signed HEAD of a .bin key to B2 as a GET', async () => {
    const sent = stubB2(new Response(null, { status: 404 }));
    await api.headObject('s/sample.bin');
    expect((await sent).cache).toBe('no-store');
  });
});

describe('deleteObject', () => {
  it('lists the versions of the key and deletes each by its id, since a plain DELETE only hides the file', async () => {
    const sent: Request[] = [];
    vi.stubGlobal('fetch', async (request: Request) => {
      sent.push(request);
      return sent.length === 1 ? new Response(VERSIONS) : new Response(null, { status: 204 });
    });
    await api.deleteObject(KEY);
    const [list, ...deletes] = sent.map((request) => new URL(request.url));
    expect(list?.pathname).toBe(`/${BUCKET}/`);
    expect(list?.searchParams.has('versions')).toBe(true);
    expect(list?.searchParams.get('prefix')).toBe(KEY);
    expect(sent.slice(1).map((request) => request.method)).toEqual(['DELETE', 'DELETE', 'DELETE']);
    expect(deletes.map((url) => url.pathname)).toEqual(Array(3).fill(`/${BUCKET}/${KEY}`));
    expect(deletes.map((url) => url.searchParams.get('versionId'))).toEqual(['v2', 'm1', 'v1']);
  });
});
