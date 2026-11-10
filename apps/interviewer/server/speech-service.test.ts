import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import { speechFileName, SpeechService } from './speech-service.ts';

const line = { text: 'Hello?', voice: 'Samantha' };
const outputOf = (args: string[]) => args[args.indexOf('-o') + 1] ?? '';

describe('speechFileName', () => {
  it('keeps one file per line and voice', () => {
    const hello = speechFileName({ text: 'Hello?', voice: 'Samantha' });
    assert.match(hello, /^[0-9a-f]{16}\.m4a$/);
    assert.equal(speechFileName({ text: 'Hello?', voice: 'Samantha' }), hello);
    assert.notEqual(speechFileName({ text: 'Hello?', voice: 'Daniel' }), hello);
  });
});

describe('SpeechService', () => {
  let dir: string;
  let cache: URL;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'speech-'));
    cache = pathToFileURL(`${dir}/`);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('speaks a line again when say was cut off halfway', async () => {
    const cutOff = async (_file: string, args: string[]) => {
      await writeFile(outputOf(args), 'half');
      throw new Error('say was killed');
    };
    await assert.rejects((await SpeechService.open(cache, cutOff)).speak(line));
    const whole = async (_file: string, args: string[]) => writeFile(outputOf(args), 'whole');
    const audio = await (await SpeechService.open(cache, whole)).speak(line);
    assert.equal(audio.toString(), 'whole');
  });

  it('runs say once for two requests of the same line', async () => {
    let runs = 0;
    const slow = async (_file: string, args: string[]) => {
      runs += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      await writeFile(outputOf(args), 'spoken');
    };
    const speech = await SpeechService.open(cache, slow);
    const [first, second] = await Promise.all([speech.speak(line), speech.speak(line)]);
    assert.equal(runs, 1);
    assert.equal(first.toString(), 'spoken');
    assert.equal(second.toString(), 'spoken');
  });
});
