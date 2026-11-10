import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

import { fontFile, tokensCss } from './page-bundle.ts';

describe('page styles', () => {
  it('renders the dark tokens', async () => {
    const css = await tokensCss();
    assert.match(css, /color-scheme: dark;/);
    assert.match(css, /--color-background: #0b0d10;/);
  });
  it('links the tokens before the page styles', async () => {
    const html = await readFile(new URL('../page/index.html', import.meta.url), 'utf8');
    const tokens = html.indexOf('href="tokens.css"');
    assert.ok(tokens >= 0 && tokens < html.indexOf('href="styles.css"'));
  });
  it('serves the app font files and nothing else', async () => {
    assert.ok((await fontFile('Inter_600SemiBold'))?.length);
    assert.ok((await fontFile('JetBrainsMono_400Regular'))?.length);
    assert.equal(await fontFile('Helvetica_400Regular'), undefined);
  });
  it('keeps raw colours out of the page rules', async () => {
    const css = await readFile(new URL('../page/styles.css', import.meta.url), 'utf8');
    const rules = css.replace(/:root\s*\{[^}]*\}/, '');
    assert.deepEqual(rules.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? [], []);
  });
});
