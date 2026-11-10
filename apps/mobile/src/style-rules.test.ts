import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const SRC = path.resolve(__dirname);
/** Colours live only in the theme; the Storybook dev button may carry its brand colour. */
const COLOUR_ALLOWED = [`theme${path.sep}`, `features${path.sep}dev${path.sep}`];

const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter(
  (file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file),
);
const offenders = (pattern: RegExp, allowed: string[] = []) =>
  files.filter(
    (file) =>
      !allowed.some((prefix) => file.startsWith(prefix)) &&
      pattern.test(readFileSync(path.join(SRC, file), 'utf8')),
  );

describe('styles', () => {
  it('never uses StyleSheet.create', () => expect(offenders(/StyleSheet\.create/)).toEqual([]));
  it('keeps literal sizes and colours out of inline styles', () =>
    expect(offenders(/style=\{\{[^}]*(\d|#|rgb)/)).toEqual([]));
  it('keeps hex and rgb colours in src/theme', () =>
    expect(offenders(/#[0-9a-f]{3,8}\b|rgba?\(/i, COLOUR_ALLOWED)).toEqual([]));
});
