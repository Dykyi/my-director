import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fontFace, themeColors, TOKENS } from './tokens.ts';

const TEXT_CONTRAST = 4.5;
// `faint` marks only disabled controls and chevrons, which need the non-text 3:1.
const MARK_CONTRAST = 3;
const SPACING_STEP_PX = 4;

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
  ['participant', 'participant-soft'],
  ['on-record', 'record'],
  ['on-primary', 'primary'],
  ['on-resume', 'resume'],
  ['on-upload', 'upload'],
  ['foreground', 'surface-bar'],
  ['muted', 'surface-bar'],
  ['accent', 'surface-bar'],
  ['foreground', 'segment-selected'],
];

// WCAG 2.2 relative luminance of `#rrggbb`.
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = (hex.slice(1).match(/../g) ?? []).map((pair) => {
    const channel = Number.parseInt(pair, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(colors: Record<string, string>, text: string, ground: string): number {
  const [light = 0, dark = 0] = [
    luminance(colors[text] ?? ''),
    luminance(colors[ground] ?? ''),
  ].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

for (const [theme, colors] of Object.entries(themeColors(TOKENS))) {
  describe(`${theme} theme`, () => {
    it('resolves every alias', () =>
      assert.deepEqual(
        Object.entries(colors).filter(([, value]) => value.startsWith('{')),
        [],
      ));
    const textPairs = [
      ...SURFACES.flatMap((ground) => TEXT_ON_SURFACES.map((text) => [text, ground] as const)),
      ...TEXT_ON_GROUNDS,
    ];
    for (const [text, ground] of textPairs) {
      it(`${text} on ${ground}`, () => assert.ok(contrast(colors, text, ground) >= TEXT_CONTRAST));
    }
    for (const ground of ['background', 'surface']) {
      it(`faint marks on ${ground}`, () =>
        assert.ok(contrast(colors, 'faint', ground) >= MARK_CONTRAST));
    }
  });
}

describe('tokens', () => {
  it('keeps spacing on the 4 px step Tailwind uses', () => {
    for (const { name, value } of TOKENS.spacing.tokens) {
      assert.equal(value, `${Number(name.replace('space-', '')) * SPACING_STEP_PX}px`, name);
    }
  });
  it('has a font face for every type style', () => {
    for (const { family, styles } of TOKENS.type.groups) {
      for (const { fontWeight } of styles) assert.doesNotThrow(() => fontFace(family, fontWeight));
    }
  });
});
