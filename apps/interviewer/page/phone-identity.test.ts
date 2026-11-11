import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { displayName, isPhoneIdentity } from './phone-identity.ts';

describe('isPhoneIdentity', () => {
  it('takes the phone setting itself or the setting with a dash and more', () => {
    const cases = [
      ['iphone', true],
      ['iphone-7F3A', true],
      ['iphoneX', false],
      ['interviewer', false],
      ['my-iphone', false],
    ] as const;
    for (const [identity, phone] of cases) assert.equal(isPhoneIdentity(identity, 'iphone'), phone);
  });
});

describe('displayName', () => {
  it('shows the name and falls back to the identity', () => {
    assert.equal(displayName({ identity: 'iphone-7F3A', name: 'Studio phone' }), 'Studio phone');
    assert.equal(displayName({ identity: 'iphone-7F3A', name: '' }), 'iphone-7F3A');
    assert.equal(displayName({ identity: 'iphone-7F3A' }), 'iphone-7F3A');
  });
});
