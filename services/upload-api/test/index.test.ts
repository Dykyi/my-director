import { afterEach, describe, expect, it, vi } from 'vitest';

import { DOWNLOAD_LINK_MAX_SEC } from '../src/b2-storage';
import worker from '../src/index';

type WorkerRequest = Parameters<typeof worker.fetch>[0];

const TOKEN = 'test-token';
const ENV = {
  UPLOAD_API_TOKEN: TOKEN,
  B2_S3_ENDPOINT: 'https://s3.eu-central-003.backblazeb2.com',
  B2_BUCKET: 'mydirector-poc-4f2a',
  B2_KEY_ID: 'B2KEYIDEXAMPLE',
  B2_APPLICATION_KEY: 'secret',
  LIVEKIT_URL: 'wss://example.livekit.cloud',
  LIVEKIT_ROOM: 'mydirector-poc',
  LIVEKIT_API_KEY: 'APIkey',
  LIVEKIT_API_SECRET: 'secret-secret-secret-secret-secret',
} as Env;

function call(method: string, path: string, init: { body?: string; token?: string } = {}) {
  const request = new Request(`https://upload.example${path}`, {
    method,
    headers: { Authorization: `Bearer ${init.token ?? TOKEN}` },
    body: init.body,
  }) as WorkerRequest;
  return worker.fetch(request, ENV);
}

function answerFromB2(...responses: Response[]) {
  const queue = [...responses];
  vi.stubGlobal('fetch', async () => queue.shift() ?? new Response(null, { status: 500 }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('routes', () => {
  it.each([
    ['GET', '/uploads/u1/parts?key=../other/y'],
    ['DELETE', '/uploads/u1?key=..'],
    ['GET', '/uploads/%E0/parts?key=s/segment-001.mov'],
    ['GET', '/download-link?key=../other/y'],
  ])('refuses %s %s as bad input', async (method, path) => {
    answerFromB2(new Response(null, { status: 500 }));
    expect((await call(method, path)).status).toBe(400);
  });

  it('answers 404 for the parts of an upload B2 no longer has', async () => {
    answerFromB2(new Response('<Error><Code>NoSuchUpload</Code></Error>', { status: 404 }));
    const response = await call('GET', '/uploads/u1/parts?key=s/segment-001.mov');
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'upload not found' });
  });

  it('answers with a week-long download link for the key', async () => {
    const response = await call('GET', '/download-link?key=s%2Fsegment-001.mov');
    expect(response.status).toBe(200);
    const link = new URL(((await response.json()) as { url: string }).url);
    expect(link.pathname).toBe('/mydirector-poc-4f2a/s/segment-001.mov');
    expect(link.searchParams.get('X-Amz-Expires')).toBe(String(DOWNLOAD_LINK_MAX_SEC));
  });

  it('refuses a wrong token', async () => {
    expect((await call('GET', '/uploads/u1/parts?key=k', { token: 'other' })).status).toBe(401);
  });

  it('answers 404 for an unknown path', async () => {
    expect((await call('GET', '/elsewhere')).status).toBe(404);
  });

  it('answers 400 for a body that is not JSON or not a valid upload', async () => {
    expect((await call('POST', '/uploads', { body: '{' })).status).toBe(400);
    expect((await call('POST', '/uploads', { body: '{"key":"k"}' })).status).toBe(400);
  });

  it('starts an upload with one signed URL per part', async () => {
    answerFromB2(
      new Response(
        '<InitiateMultipartUploadResult><UploadId>u1</UploadId></InitiateMultipartUploadResult>',
      ),
    );
    const md5 = 'rL0Y20zC+Fzt72VPzMSk2A==';
    const body = JSON.stringify({
      key: 's/segment-001.mov',
      size: 6_000_000,
      partSize: 5_242_880,
      partMd5s: [md5, md5],
    });
    const response = await call('POST', '/uploads', { body });
    expect(response.status).toBe(200);
    const created: { uploadId: string; parts: { partNumber: number }[]; expiresAt: string } =
      await response.json();
    expect(created.uploadId).toBe('u1');
    expect(created.parts.map((part) => part.partNumber)).toEqual([1, 2]);
    expect(created.expiresAt).toMatch(/Z$/);
  });

  it('deletes every version of an object', async () => {
    answerFromB2(
      new Response(
        '<ListVersionsResult><Version><Key>s/segment-001.mov</Key><VersionId>v1</VersionId></Version></ListVersionsResult>',
      ),
      new Response(null, { status: 204 }),
    );
    expect((await call('DELETE', '/objects?key=s/segment-001.mov')).status).toBe(204);
  });
});

describe('POST /livekit-token', () => {
  it('needs the upload token', async () =>
    expect(
      (await call('POST', '/livekit-token', { body: '{"installId":"7F3A"}', token: 'wrong' }))
        .status,
    ).toBe(401));

  it('answers with a grant for this install', async () => {
    const body = JSON.stringify({ installId: '7F3A', name: 'Studio' });
    const response = await call('POST', '/livekit-token', { body });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      identity: 'iphone-7F3A',
      room: ENV.LIVEKIT_ROOM,
      url: ENV.LIVEKIT_URL,
    });
  });

  it('rejects a bad install id', async () =>
    expect((await call('POST', '/livekit-token', { body: '{"installId":"?"}' })).status).toBe(400));
});
