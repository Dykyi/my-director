import { describe, expect, it, jest } from '@jest/globals';

import { memoryKvStore as mockKvStore } from '@test/memory-kv-store';

import { callName, installId } from './call-identity';
import { lastCallTarget } from './call-target';
import { joinCall, requestCallGrant } from './call-token';

jest.mock('expo-sqlite/kv-store', () => mockKvStore);

const api = { baseUrl: 'https://upload.example.workers.dev', token: 'secret' };
const REQUEST = { installId: '7F3A', name: 'Studio phone' };
const GRANT = {
  url: 'wss://mydirector-poc.livekit.cloud',
  room: 'mydirector-poc',
  identity: 'iphone-7F3A',
  token: 'header.payload.signature',
};

const answer = (status: number, body: unknown) =>
  jest.fn(
    async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );

describe('requestCallGrant', () => {
  it('asks the Worker for a token under this install and name', async () => {
    const fetcher = answer(200, GRANT);
    await requestCallGrant(api, REQUEST, fetcher);
    expect(fetcher).toHaveBeenCalledWith('https://upload.example.workers.dev/livekit-token', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
      body: JSON.stringify(REQUEST),
    });
  });

  it('returns the server, the room, the identity and the token', async () =>
    expect(await requestCallGrant(api, REQUEST, answer(200, GRANT))).toEqual(GRANT));

  it('names the status and the reason of a refusal', async () =>
    expect(requestCallGrant(api, REQUEST, answer(401, { error: 'unauthorized' }))).rejects.toThrow(
      'Could not join the call: the token service answered 401 (unauthorized)',
    ));

  it('names the status alone when the refusal has no reason', async () =>
    expect(requestCallGrant(api, REQUEST, answer(502, 'Bad gateway'))).rejects.toThrow(
      'Could not join the call: the token service answered 502',
    ));

  it('passes on why the request did not get through', async () => {
    const offline = jest.fn(async (_url: string, _init: RequestInit): Promise<Response> => {
      throw new TypeError('Network request failed');
    });
    await expect(requestCallGrant(api, REQUEST, offline)).rejects.toThrow(
      'Could not join the call: Network request failed',
    );
  });

  it('rejects an answer without a token', async () =>
    expect(
      requestCallGrant(api, REQUEST, answer(200, { ...GRANT, token: undefined })),
    ).rejects.toThrow('Could not join the call: the token service sent no usable token'));
});

describe('joinCall', () => {
  const sentBody = (fetcher: ReturnType<typeof answer>) =>
    JSON.parse(String(fetcher.mock.calls[0]?.[1].body)) as unknown;
  const TARGET = { serverUrl: GRANT.url, room: GRANT.room, identity: GRANT.identity };

  it('asks under this install and the saved name, and starts with the token', async () => {
    callName.set('Studio phone');
    const fetcher = answer(200, GRANT);
    const start = jest.fn(async (_credentials: { url: string; token: string }) => 'session');
    await joinCall(api, start, fetcher);
    expect(sentBody(fetcher)).toEqual({ installId: installId(), name: 'Studio phone' });
    expect(start).toHaveBeenCalledWith({ url: GRANT.url, token: GRANT.token });
  });

  it('asks under the default name until the phone is renamed', async () => {
    callName.set(undefined);
    const fetcher = answer(200, GRANT);
    await joinCall(api, async () => 'session', fetcher);
    expect(sentBody(fetcher)).toMatchObject({ name: 'iphone' });
  });

  it('remembers where the call led once the start has joined', async () => {
    lastCallTarget.set(undefined);
    let joined: () => void = () => {};
    const start = () => new Promise<void>((resolve) => (joined = resolve));
    const joining = joinCall(api, start, answer(200, GRANT));
    await new Promise(setImmediate);
    expect(lastCallTarget.get()).toBeUndefined();
    joined();
    await joining;
    expect(lastCallTarget.get()).toEqual(TARGET);
  });

  it('keeps the last target when the start fails', async () => {
    const earlier = { ...TARGET, identity: 'iphone-OLD1' };
    lastCallTarget.set(earlier);
    const start = async () => {
      throw new Error('callConnectFailed: No connection after 15 s');
    };
    await expect(joinCall(api, start, answer(200, GRANT))).rejects.toThrow('No connection');
    expect(lastCallTarget.get()).toEqual(earlier);
  });
});
