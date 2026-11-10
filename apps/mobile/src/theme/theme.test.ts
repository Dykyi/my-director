import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import {
  renderThemeColors,
  renderThemeCss,
  renderTypeStyles,
  TOKENS,
} from '@mydirector/design-system';

import { THEME_COLORS, type ThemeName } from './colors';
import { FONTS } from './fonts';
import { TYPE_STYLES } from './type-styles';

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const THEMES: ThemeName[] = ['light', 'dark'];

describe('generated theme files', () => {
  it.each([
    ['src/theme/theme.css', renderThemeCss],
    ['src/theme/colors.ts', renderThemeColors],
    ['src/theme/type-styles.ts', renderTypeStyles],
  ])('%s matches design/tokens.json; run yarn tokens', (file, render) =>
    expect(read(file)).toBe(render(TOKENS)),
  );

  it('mirrors every colour of both themes in CSS and TS', () => {
    const css = read('src/theme/theme.css');
    for (const theme of THEMES) {
      const block = new RegExp(`@variant ${theme} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
      const fromCss = Object.fromEntries(
        [...block.matchAll(/--color-([\w-]+): ([^;]+);/g)].map(([, name, value]) => [name, value]),
      );
      expect(fromCss).toEqual(THEME_COLORS[theme]);
    }
  });
});

describe('fonts', () => {
  it('loads every face a type style names', () => {
    const faces = new Set(Object.values(TYPE_STYLES).map((style) => style.fontFamily));
    expect([...faces].filter((face) => !(face in FONTS))).toEqual([]);
  });
});
