import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

import { MAX_SPEECH_CHARS } from '../server/requests.ts';
import { parseParagraphs, ReadingRun, speechParts } from './reading-run.ts';

describe('parseParagraphs', () => {
  it('splits on blank lines and joins wrapped lines', () =>
    assert.deepEqual(parseParagraphs('One\ntwo.\n  \n\nThree.\n'), ['One two.', 'Three.']));

  it('splits a paragraph too long to speak into parts that end a sentence', () => {
    const paragraph = 'This sentence belongs to a very long paragraph. '.repeat(25).trim();
    const parts = parseParagraphs(paragraph);
    assert.ok(parts.length > 1);
    for (const part of parts) {
      assert.ok(part.length <= MAX_SPEECH_CHARS);
      assert.ok(part.endsWith('.'));
    }
    assert.equal(parts.join(' '), paragraph);
  });

  it('keeps every paragraph of the built-in text short enough to speak', async () => {
    const text = await readFile(new URL('../reading.txt', import.meta.url), 'utf8');
    const paragraphs = parseParagraphs(text);
    assert.ok(paragraphs.length >= 20);
    for (const paragraph of paragraphs) assert.ok(paragraph.length <= MAX_SPEECH_CHARS, paragraph);
  });
});

describe('speechParts', () => {
  it('keeps a short paragraph whole', () =>
    assert.deepEqual(speechParts('One two. Three.', 20), ['One two. Three.']));

  it('cuts at the last sentence end that fits', () =>
    assert.deepEqual(speechParts('One two. Three four! Five six?', 20), [
      'One two. Three four!',
      'Five six?',
    ]));

  it('falls back to the last space inside one long sentence', () =>
    assert.deepEqual(speechParts('aaa bbb ccc ddd eee', 10), ['aaa bbb', 'ccc ddd', 'eee']));
});

describe('ReadingRun', () => {
  const run = () => new ReadingRun(['a', 'b', 'c']);

  it('goes round and knows the paragraph after the current one', () => {
    const r = run();
    assert.equal(r.nextText, 'b');
    r.advance();
    r.advance();
    assert.equal(r.text, 'c');
    assert.equal(r.nextText, 'a');
    r.advance();
    assert.equal(r.current, 0);
  });

  it('counts only the time it reads', () => {
    const r = run();
    r.resume(0);
    r.resume(2_000);
    r.pause(4_000);
    r.pause(5_000);
    r.resume(60_000);
    assert.equal(r.elapsedMs(63_000), 7_000);
  });

  it('is done at the limit', () => {
    const r = run();
    r.resume(0);
    assert.equal(r.isDone(9_999, 10_000), false);
    assert.equal(r.isDone(10_000, 10_000), true);
  });
});
