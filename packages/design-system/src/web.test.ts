import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fontFaces, themeColors, TOKENS } from './tokens.ts';
import { renderWebCss } from './web.ts';

describe('renderWebCss', () => {
  const css = renderWebCss(TOKENS, 'dark');

  it('sets the colour scheme', () => assert.match(css, /color-scheme: dark;/));
  it('declares every colour of the theme', () => {
    for (const [name, value] of Object.entries(themeColors(TOKENS).dark ?? {})) {
      assert.ok(css.includes(`--color-${name}: ${value};`), name);
    }
  });
  it('declares radii and spacing, writing a dot in a name as an underscore', () => {
    assert.match(css, /--radius-pill: 999px;/);
    assert.match(css, /--space-0_5: 2px;/);
  });
  it('refuses an unknown theme', () => assert.throws(() => renderWebCss(TOKENS, 'sepia')));
  it('declares the font stacks and a whole style per type token', () => {
    assert.match(css, /--font-sans: Inter, -apple-system, system-ui, sans-serif;/);
    assert.match(css, /--text-callout: 400 14px\/20px var\(--font-sans\);/);
    assert.match(css, /--text-prompter: 600 24px\/32px var\(--font-sans\);/);
    assert.match(css, /--tracking-section-label: 0.72px;/);
  });
  it('loads every face a style names from the fonts folder', () => {
    for (const { face, family, weight } of fontFaces(TOKENS)) {
      assert.ok(css.includes(`font-family: '${family}';\n  font-weight: ${weight};`), face);
      assert.ok(css.includes(`url('fonts/${face}.ttf')`), face);
    }
  });
});
