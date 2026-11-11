import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

import { MAX_SPEECH_CHARS } from '../server/requests.ts';
import { parseDemoScript } from './demo-script.ts';

describe('parseDemoScript', () => {
  it('turns two blocks into four lines that take turns', () =>
    assert.deepEqual(parseDemoScript('Who are you?\nI fix bikes.\n\nWhy?\nI like it.\nA lot.'), [
      { speaker: 'interviewer', text: 'Who are you?' },
      { speaker: 'guest', text: 'I fix bikes.' },
      { speaker: 'interviewer', text: 'Why?' },
      { speaker: 'guest', text: 'I like it. A lot.' },
    ]));

  it('lets a block without an answer only ask', () =>
    assert.deepEqual(parseDemoScript('Any last words?'), [
      { speaker: 'interviewer', text: 'Any last words?' },
    ]));

  it('splits an answer too long to speak into two guest lines', () => {
    const answer = 'This sentence belongs to a long answer. '.repeat(15).trim();
    const lines = parseDemoScript(`Tell me more.\n${answer}`);
    assert.deepEqual(
      lines.map(({ speaker }) => speaker),
      ['interviewer', 'guest', 'guest'],
    );
    for (const { text } of lines) assert.ok(text.length <= MAX_SPEECH_CHARS);
  });

  it('makes no empty lines from extra blank lines and spaces', () =>
    assert.deepEqual(parseDemoScript('\n\n  Hello?  \n   Hi   there.  \n\n\n \n\nBye?\n\n'), [
      { speaker: 'interviewer', text: 'Hello?' },
      { speaker: 'guest', text: 'Hi there.' },
      { speaker: 'interviewer', text: 'Bye?' },
    ]));

  it('asks sixteen questions in the built-in dialog, each answered in one line', async () => {
    const text = await readFile(new URL('../demo.txt', import.meta.url), 'utf8');
    const lines = parseDemoScript(text);
    assert.equal(lines.length, 32);
    lines.forEach(({ speaker }, index) =>
      assert.equal(speaker, index % 2 === 0 ? 'interviewer' : 'guest'),
    );
  });
});
