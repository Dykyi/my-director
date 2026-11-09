import { describe, expect, it } from 'vitest';

import { isAuthorized } from '../src/auth';

const request = (authorization?: string) =>
  new Request('https://api.example/uploads', { headers: authorization ? { Authorization: authorization } : {} });

describe('isAuthorized', () => {
  it('accepts the right bearer token', () => expect(isAuthorized(request('Bearer secret'), 'secret')).toBe(true));
  it('rejects a wrong token', () => expect(isAuthorized(request('Bearer secreT'), 'secret')).toBe(false));
  it('rejects a missing header', () => expect(isAuthorized(request(), 'secret')).toBe(false));
  it('rejects everything when no token is configured', () =>
    expect(isAuthorized(request('Bearer undefined'), undefined)).toBe(false));
  it('rejects a longer token with the right prefix', () => expect(isAuthorized(request('Bearer secret2'), 'secret')).toBe(false));
});
