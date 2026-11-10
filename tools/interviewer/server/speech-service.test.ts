import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { speechFileName } from './speech-service.ts';

describe('speechFileName', () => {
  it('keeps one file per line and voice', () => {
    const hello = speechFileName({ text: 'Hello?', voice: 'Samantha' });
    assert.match(hello, /^[0-9a-f]{16}\.m4a$/);
    assert.equal(speechFileName({ text: 'Hello?', voice: 'Samantha' }), hello);
    assert.notEqual(speechFileName({ text: 'Hello?', voice: 'Daniel' }), hello);
  });
});
