import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { deleteFromBucket } from './bucket';

const api = { baseUrl: 'https://upload.example.workers.dev', token: 'secret' };
const KEY = '2026-11-10T09-12-33Z-4F2A/segment-001.mov';

function answer(status: number) {
  const fetchMock = jest.fn(
    async (_url: string, _init: RequestInit) => new Response(null, { status }),
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
