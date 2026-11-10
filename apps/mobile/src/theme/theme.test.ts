import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

import { THEME_COLORS, type ThemeName } from './colors';
import { FONTS } from './fonts';
import {
  renderThemeColors,
  renderThemeCss,
  renderTypeStyles,
  type DesignTokens,
} from './render-tokens';
import { TYPE_STYLES } from './type-styles';

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const tokens = JSON.parse(read('../../design/tokens.json')) as DesignTokens;
const THEMES: ThemeName[] = ['light', 'dark'];

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = (hex.slice(1).match(/../g) ?? []).map((pair) => {
    const channel = Number.parseInt(pair, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(theme: ThemeName, text: string, ground: string): number {
  const colors: Record<string, string> = THEME_COLORS[theme];
  const [light = 0, dark = 0] = [
    luminance(colors[text] ?? ''),
    luminance(colors[ground] ?? ''),
  ].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

const SURFACES = ['background', 'surface', 'surface-raised'];
const TEXT_ON_SURFACES = [
  'foreground',
  'subtle',
  'muted',
  'accent',
  'danger',
  'paused',
  'warning',
  'success',
];
const TEXT_ON_GROUNDS: [text: string, ground: string][] = [
  ['recording', 'recording-soft'],
  ['recording-detail', 'recording-soft'],
  ['on-recording-soft', 'danger-soft'],
  ['danger', 'danger-soft'],
  ['paused', 'paused-soft'],
  ['warning', 'warning-soft'],
  ['on-warning-soft', 'warning-soft'],
  ['success', 'success-soft'],
  ['accent', 'accent-soft'],
  ['on-record', 'record'],
  ['on-primary', 'primary'],
  ['on-resume', 'resume'],
  ['on-upload', 'upload'],
  ['foreground', 'surface-bar'],
  ['muted', 'surface-bar'],
  ['accent', 'surface-bar'],
  ['foreground', 'segment-selected'],
];
const TEXT_CONTRAST = 4.5;
const MARK_CONTRAST = 3;

describe('generated theme files', () => {
  it.each([
    ['src/theme/theme.css', renderThemeCss],
    ['src/theme/colors.ts', renderThemeColors],
    ['src/theme/type-styles.ts', renderTypeStyles],
  ])('%s matches design/tokens.json; run yarn tokens', (file, render) =>
    expect(read(file)).toBe(render(tokens)),
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

describe.each(THEMES)('%s theme contrast', (theme) => {
  it.each(SURFACES.flatMap((ground) => TEXT_ON_SURFACES.map((text) => [text, ground])))(
    '%s on %s',
    (text, ground) => expect(contrast(theme, text, ground)).toBeGreaterThanOrEqual(TEXT_CONTRAST),
  );
  it.each(TEXT_ON_GROUNDS)('%s on %s', (text, ground) =>
    expect(contrast(theme, text, ground)).toBeGreaterThanOrEqual(TEXT_CONTRAST),
  );
  it.each(['background', 'surface'])('faint marks on %s', (ground) =>
    expect(contrast(theme, 'faint', ground)).toBeGreaterThanOrEqual(MARK_CONTRAST),
  );
});

describe('fonts', () => {
  it('loads every face a type style names', () => {
    const faces = new Set(Object.values(TYPE_STYLES).map((style) => style.fontFamily));
    expect([...faces].filter((face) => !(face in FONTS))).toEqual([]);
  });
});
