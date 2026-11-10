import { describe, expect, it } from '@jest/globals';

import { tokenGrant } from './token-grant';

const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
const token = `${encode({ alg: 'HS256' })}.${encode({ sub: 'iphone', video: { room: 'mydirector-poc' } })}.signature`;

describe('tokenGrant', () => {
  it('reads the room and the identity from the call token', () =>
    expect(tokenGrant(token)).toEqual({ room: 'mydirector-poc', identity: 'iphone' }));
  it('copes with a token it cannot read', () => expect(tokenGrant('not-a-token')).toEqual({}));
});
