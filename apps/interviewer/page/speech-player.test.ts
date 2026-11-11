import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { SpeechPlayer } from './speech-player.ts';

/** An audio element whose play() starts only when the test says so. */
class FakeElement {
  src = '';
  played: string[] = [];
  paused = 0;
  currentTime = 2.5;
  duration = Number.NaN;
  #ended: (() => void) | undefined;
  #start: (() => void) | undefined;
  addEventListener(_type: string, listener: () => void): void {
    this.#ended = listener;
  }
  play(): Promise<void> {
    this.played.push(this.src);
    return new Promise((start) => (this.#start = start));
  }
  pause(): void {
    this.paused += 1;
  }
  start(): void {
    this.#start?.();
  }
  end(): void {
    this.#ended?.();
  }
}

let requests: { text: string; answer: () => void; refuse: () => void }[];

beforeEach(() => {
  requests = [];
  globalThis.fetch = (async (_path: string, init: RequestInit) => {
    const { text } = JSON.parse(String(init.body));
    const ok = await new Promise<boolean>((reply) =>
      requests.push({ text, answer: () => reply(true), refuse: () => reply(false) }),
    );
    return ok
      ? new Response(new Blob([text]))
      : Response.json({ error: 'unknown voice' }, { status: 400 });
  }) as typeof fetch;
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'fetch');
});

const settle = () => new Promise((resolve) => setImmediate(resolve));

const MAX_SETTLES = 100;

async function until(done: () => boolean): Promise<void> {
  for (let settled = 0; settled < MAX_SETTLES && !done(); settled += 1) await settle();
  assert.ok(done(), 'the condition never came true');
}

function setUp() {
  const element = new FakeElement();
  let spoken = 0;
  const player = new SpeechPlayer(element as unknown as HTMLAudioElement, () => (spoken += 1));
  const playing = () => until(() => element.played.length > 0);
  return { element, player, playing, spoken: () => spoken };
}

describe('SpeechPlayer', () => {
  it('sounds only once play starts and says when it ended', async () => {
    const { element, player, playing, spoken } = setUp();
    const speak = player.speak('Hello.', 'Daniel');
    assert.equal(player.speaking, true);
    assert.equal(player.sounding, false);
    await settle();
    requests[0]?.answer();
    await playing();
    assert.equal(player.sounding, false);
    element.start();
    assert.equal(await speak, true);
    assert.equal(player.sounding, true);
    assert.deepEqual(player.progress, { atSec: 2.5, lengthSec: 0 });
    element.end();
    assert.equal(player.speaking, false);
    assert.equal(player.sounding, false);
    assert.equal(spoken(), 1);
  });

  it('lets a newer line win over an older one still on its way', async () => {
    const { element, player, playing } = setUp();
    const older = player.speak('Older.', 'Daniel');
    const newer = player.speak('Newer.', 'Daniel');
    await settle();
    requests[1]?.answer();
    await playing();
    element.start();
    requests[0]?.answer();
    assert.deepEqual(await Promise.all([older, newer]), [false, true]);
    assert.equal(element.played.length, 1);
    assert.equal(player.sounding, true);
  });

  it('drops a line stopped on its way', async () => {
    const { element, player } = setUp();
    const speak = player.speak('Hello.', 'Daniel');
    player.stop();
    assert.equal(player.speaking, false);
    await settle();
    requests[0]?.answer();
    assert.equal(await speak, false);
    assert.deepEqual(element.played, []);
  });

  it('drops a line stopped while it starts to play', async () => {
    const { element, player, playing } = setUp();
    const speak = player.speak('Hello.', 'Daniel');
    await settle();
    requests[0]?.answer();
    await playing();
    player.stop();
    element.start();
    assert.equal(await speak, false);
    assert.equal(player.speaking, false);
    assert.equal(player.sounding, false);
  });

  it('stays silent when sounding stops', async () => {
    const { element, player, playing } = setUp();
    const speak = player.speak('Hello.', 'Daniel');
    await settle();
    requests[0]?.answer();
    await playing();
    element.start();
    await speak;
    player.stop();
    assert.equal(player.sounding, false);
  });

  it('rejects and stays silent when the speech cannot be fetched', async () => {
    const { player } = setUp();
    const speak = player.speak('Hello.', 'Nobody');
    await settle();
    requests[0]?.refuse();
    await assert.rejects(speak, /unknown voice/);
    assert.equal(player.speaking, false);
    assert.equal(player.sounding, false);
  });

  it('fetches a prefetched line once', async () => {
    const { element, player, playing } = setUp();
    player.prefetch('Hello.', 'Daniel');
    const speak = player.speak('Hello.', 'Daniel');
    await settle();
    requests[0]?.answer();
    await playing();
    element.start();
    assert.equal(await speak, true);
    assert.deepEqual(
      requests.map(({ text }) => text),
      ['Hello.'],
    );
  });
});
