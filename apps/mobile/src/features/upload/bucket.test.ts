import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { deleteFromBucket, downloadLink } from './bucket';

const api = { baseUrl: 'https://upload.example.workers.dev', token: 'secret' };
const KEY = '2026-11-10T09-12-33Z-4F2A/segment-001.mov';

function answer(status: number, body: string | null = null) {
  const fetchMock = jest.fn(
    async (_url: string, _init: RequestInit) => new Response(body, { status }),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('deleteFromBucket', () => {
  it('asks the Worker to delete the object with the bearer token', async () => {
    const fetchMock = answer(204);
    await deleteFromBucket(api, KEY);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://upload.example.workers.dev/objects?key=2026-11-10T09-12-33Z-4F2A%2Fsegment-001.mov',
      { method: 'DELETE', headers: { Authorization: 'Bearer secret' } },
    );
  });

  it('fails with the HTTP status', async () => {
    answer(500);
    await expect(deleteFromBucket(api, KEY)).rejects.toThrow('HTTP 500');
  });
});

describe('downloadLink', () => {
  const LINK = 'https://s3.us-east-005.backblazeb2.com/b/k?X-Amz-Signature=abc';

  it('asks the Worker for a link with the bearer token and returns it', async () => {
    const fetchMock = answer(200, JSON.stringify({ url: LINK }));
    await expect(downloadLink(api, KEY)).resolves.toBe(LINK);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://upload.example.workers.dev/download-link?key=2026-11-10T09-12-33Z-4F2A%2Fsegment-001.mov',
      { headers: { Authorization: 'Bearer secret' } },
    );
  });

  it('fails with the HTTP status', async () => {
    answer(500);
    await expect(downloadLink(api, KEY)).rejects.toThrow('HTTP 500');
  });

  it('fails when the answer holds no link', async () => {
    answer(200, '{}');
    await expect(downloadLink(api, KEY)).rejects.toThrow('the Worker sent no link');
  });

  it('says what failed when the request never reaches the Worker', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error(
        'fetch failed: UnexpectedException: The Internet connection appears to be offline. (at ExpoModulesCore/Promise.swift:56)',
      );
    }) as unknown as typeof fetch;
    await expect(downloadLink(api, KEY)).rejects.toThrow(
      'Could not make a download link: The Internet connection appears to be offline.',
    );
  });
});
