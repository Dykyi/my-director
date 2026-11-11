import { describe, expect, it } from 'vitest';

import { issueLiveKitToken, parseTokenRequest } from '../src/livekit-token';
import { InputError } from '../src/validation';

const CONFIG = {
  url: 'wss://example.livekit.cloud',
  room: 'mydirector-poc',
  apiKey: 'APIkey',
  apiSecret: 'secret-secret-secret-secret-secret',
};

const claims = (jwt: string): Record<string, any> =>
  JSON.parse(atob(jwt.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));

describe('parseTokenRequest', () => {
  it('takes the install id and a trimmed name', () =>
    expect(parseTokenRequest({ installId: '7F3A', name: '  Studio phone ' })).toEqual({
      installId: '7F3A',
      name: 'Studio phone',
    }));
  it('falls back to the default name', () =>
    expect(parseTokenRequest({ installId: '7F3A', name: '  ' }).name).toBe('iphone'));
  it.each([{}, { installId: 'ab' }, { installId: 'a-b-c-d' }, { installId: 'x'.repeat(17) }])(
    'rejects install id %j',
    (body) => expect(() => parseTokenRequest(body)).toThrow(InputError),
  );
  it('rejects a name over 40 characters', () =>
    expect(() => parseTokenRequest({ installId: '7F3A', name: 'n'.repeat(41) })).toThrow(
      InputError,
    ));
});

describe('issueLiveKitToken', () => {
  it('names the phone after its install and grants the room for 24 hours', async () => {
    const grant = await issueLiveKitToken({ installId: '7F3A', name: 'Studio phone' }, CONFIG);
    expect(grant).toMatchObject({
      url: CONFIG.url,
      room: 'mydirector-poc',
      identity: 'iphone-7F3A',
    });
    const payload = claims(grant.token);
    expect(payload).toMatchObject({ sub: 'iphone-7F3A', name: 'Studio phone', iss: 'APIkey' });
    expect(payload.video).toMatchObject({
      roomJoin: true,
      room: 'mydirector-poc',
      canPublish: true,
      canSubscribe: true,
      canUpdateOwnMetadata: true,
    });
    expect(payload.exp - payload.nbf).toBe(24 * 60 * 60);
  });
});
