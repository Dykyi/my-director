import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseVoices } from './voice-catalog.ts';

const SAY_OUTPUT = [
  'Thomas              fr_FR    # Bonjour, je m’appelle Thomas.',
  'Bad News            en_US    # The light you see at the end of the tunnel.',
  'Samantha            en_US    # Hello! My name is Samantha.',
  '',
].join('\n');

describe('parseVoices', () => {
  it('reads names with spaces and puts English voices first', () =>
    assert.deepEqual(parseVoices(SAY_OUTPUT), [
      { name: 'Bad News', locale: 'en_US' },
      { name: 'Samantha', locale: 'en_US' },
      { name: 'Thomas', locale: 'fr_FR' },
    ]));
});
