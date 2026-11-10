import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const SRC = path.resolve(__dirname);
const GROUPS = ['UI/', 'Features/'];
/** The player needs a real file on the phone; the Recordings tab shows it. */
const WITHOUT_STORY = new Set([path.join('features', 'recordings', 'components', 'player.tsx')]);

const components = [
  ...readdirSync(path.join(SRC, 'ui')).map((file) => path.join('ui', file)),
  ...readdirSync(path.join(SRC, 'features')).flatMap((feature) => {
    const folder = path.join('features', feature, 'components');
    return existsSync(path.join(SRC, folder))
      ? readdirSync(path.join(SRC, folder)).map((file) => path.join(folder, file))
      : [];
  }),
].filter((file) => file.endsWith('.tsx') && !WITHOUT_STORY.has(file));

const storyOf = (file: string) =>
  path.join(path.dirname(file), '__stories__', path.basename(file).replace('.tsx', '.stories.tsx'));
const stories = components.map(storyOf).filter((story) => existsSync(path.join(SRC, story)));
const read = (story: string) => readFileSync(path.join(SRC, story), 'utf8');

describe('stories', () => {
  it('cover every kit file and feature component', () =>
    expect(components.filter((file) => !existsSync(path.join(SRC, storyOf(file))))).toEqual([]));

  // The title comes from `const meta = {`: fixture data may carry its own `title`.
  it('sit in a sidebar group', () =>
    expect(
      stories.filter((story) => {
        const title = /const meta = \{\s*title: '([^']+)'/.exec(read(story))?.[1] ?? '';
        return !GROUPS.some((group) => title.startsWith(group));
      }),
    ).toEqual([]));

  // Controls walks args; a React element leads it into navigation internals and blanks the canvas.
  it('keep React elements out of args', () =>
    expect(
      stories.filter((story) =>
        [...read(story).matchAll(/args: \{([^}]*)\}/g)].some(([, block = '']) =>
          /<[A-Z]/.test(block),
        ),
      ),
    ).toEqual([]));
});
