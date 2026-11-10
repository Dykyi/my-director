import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderTypeStyles } from './mobile.ts';
import { TOKENS } from './tokens.ts';

describe('renderTypeStyles', () => {
  it('leaves the web-only styles out of the app', () => {
    const styles = renderTypeStyles(TOKENS);
    assert.match(styles, /'callout':/);
    assert.doesNotMatch(styles, /'prompter':/);
  });
});
