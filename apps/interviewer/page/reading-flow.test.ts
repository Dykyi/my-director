import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ReadingFlow } from './reading-flow.ts';
import { DEFAULT_SETTINGS, type Settings } from './settings-store.ts';

const PARAGRAPHS = ['One two three four five six seven.', 'Second paragraph.', 'Third paragraph.'];
const MINUTE_MS = 60_000;
const settle = () => new Promise((resolve) => setImmediate(resolve));

class FakeAsker {
  speaking = false;
  failing = false;
  spoken: string[] = [];
  prefetched: string[] = [];
  async speak(text: string): Promise<boolean> {
    if (this.failing) throw new Error('say failed');
    this.speaking = true;
    this.spoken.push(text);
    return true;
  }
  stop(): void {
    this.speaking = false;
  }
  prefetch(text: string): void {
    this.prefetched.push(text);
  }
}

function setUp(overrides: Partial<Settings> = {}, guest = false) {
  const asker = new FakeAsker();
  const phone = { ready: true, paused: false };
  const settings: Settings = { ...DEFAULT_SETTINGS, mode: 'reading', ...overrides };
  const log: string[] = [];
  const clock = { now: 0 };
  const host = {
    settings: () => settings,
    guest,
    phone,
    log: (message: string) => log.push(message),
    changed: () => {},
  };
  const flow = new ReadingFlow(PARAGRAPHS, asker, host, () => clock.now);
  const finishParagraph = async (atMs: number) => {
    clock.now = atMs;
    asker.speaking = false;
    flow.paragraphSpoken();
    await settle();
  };
  return { flow, asker, phone, log, clock, finishParagraph };
}

describe('ReadingFlow', () => {
  it('reads the first paragraph once the phone is ready and fetches the next one', async () => {
    const { flow, asker, log } = setUp();
    flow.phoneReady();
    await settle();
    assert.equal(flow.running, true);
    assert.deepEqual(asker.spoken, [PARAGRAPHS[0]]);
    assert.deepEqual(asker.prefetched, [PARAGRAPHS[1]]);
    assert.deepEqual(log, ['Read 1: One two three four five six…']);
  });

  it('waits for Start when the reading does not start on join, and for a guest', () => {
    const manual = setUp({ startOnJoin: false });
    manual.flow.phoneReady();
    assert.deepEqual(manual.asker.spoken, []);
    const guest = setUp({}, true);
    guest.flow.phoneReady();
    assert.deepEqual(guest.asker.spoken, []);
  });

  it('reads on right after each paragraph and goes round after the last', async () => {
    const { flow, asker, log, finishParagraph } = setUp();
    flow.phoneReady();
    await settle();
    await finishParagraph(MINUTE_MS);
    await finishParagraph(2 * MINUTE_MS);
    await finishParagraph(3 * MINUTE_MS);
    assert.deepEqual(asker.spoken, [...PARAGRAPHS, PARAGRAPHS[0]]);
    assert.equal(flow.run.current, 0);
    assert.equal(log[1], 'Read 2: Second paragraph.');
  });

  it('reads the cut-off paragraph again from its start after a pause', async () => {
    const { flow, asker, phone, clock } = setUp();
    flow.phoneReady();
    await settle();
    clock.now = 4 * MINUTE_MS;
    phone.paused = true;
    flow.phonePaused();
    assert.equal(asker.speaking, false);
    clock.now = 30 * MINUTE_MS;
    phone.paused = false;
    flow.phoneResumed();
    flow.phoneReady();
    await settle();
    assert.deepEqual(asker.spoken, [PARAGRAPHS[0], PARAGRAPHS[0]]);
    assert.equal(flow.run.elapsedMs(31 * MINUTE_MS), 5 * MINUTE_MS);
  });

  it('counts only the recorded time and stops after the paragraph that reaches the limit', async () => {
    const { flow, asker, phone, log, clock, finishParagraph } = setUp();
    flow.phoneReady();
    await settle();
    clock.now = 4 * MINUTE_MS;
    phone.paused = true;
    flow.phonePaused();
    clock.now = 30 * MINUTE_MS;
    phone.paused = false;
    flow.phoneResumed();
    await settle();
    await finishParagraph(35 * MINUTE_MS);
    assert.equal(flow.running, true);
    await finishParagraph(36 * MINUTE_MS);
    assert.equal(flow.running, false);
    assert.deepEqual(asker.spoken, [PARAGRAPHS[0], PARAGRAPHS[0], PARAGRAPHS[1]]);
    assert.equal(log.at(-1), 'Reading finished after 10:00');
  });

  it('starts only while the phone records', async () => {
    const { flow, asker, phone } = setUp({ startOnJoin: false });
    phone.ready = false;
    flow.toggle();
    phone.ready = true;
    phone.paused = true;
    flow.toggle();
    await settle();
    assert.equal(flow.running, false);
    assert.deepEqual(asker.spoken, []);
    phone.paused = false;
    flow.toggle();
    await settle();
    assert.deepEqual(asker.spoken, [PARAGRAPHS[0]]);
  });

  it('starts and stops on the button, starting over each time', async () => {
    const { flow, asker, clock, finishParagraph } = setUp({ startOnJoin: false });
    flow.toggle();
    await settle();
    await finishParagraph(MINUTE_MS);
    flow.toggle();
    assert.equal(flow.running, false);
    assert.equal(asker.speaking, false);
    await finishParagraph(2 * MINUTE_MS);
    assert.deepEqual(asker.spoken, PARAGRAPHS.slice(0, 2));
    clock.now = 3 * MINUTE_MS;
    flow.toggle();
    await settle();
    assert.equal(flow.run.current, 0);
    assert.equal(flow.run.elapsedMs(3 * MINUTE_MS), 0);
    assert.deepEqual(asker.spoken, [...PARAGRAPHS.slice(0, 2), PARAGRAPHS[0]]);
  });

  it('waits while the phone is away and reads the cut-off paragraph again on its return', async () => {
    const { flow, asker, phone, clock, finishParagraph } = setUp();
    flow.phoneReady();
    await settle();
    await finishParagraph(MINUTE_MS);
    clock.now = 2 * MINUTE_MS;
    phone.ready = false;
    flow.phoneLeft();
    assert.equal(flow.running, true);
    assert.equal(asker.speaking, false);
    clock.now = 20 * MINUTE_MS;
    phone.ready = true;
    flow.phoneReady();
    flow.phoneReady();
    await settle();
    assert.deepEqual(asker.spoken, [PARAGRAPHS[0], PARAGRAPHS[1], PARAGRAPHS[1]]);
    assert.equal(flow.run.current, 1);
    assert.equal(flow.run.elapsedMs(21 * MINUTE_MS), 3 * MINUTE_MS);
  });

  it('does not start by itself when it takes over with the phone already here', async () => {
    const { flow, asker, phone } = setUp();
    flow.holdAutoStart();
    phone.paused = true;
    flow.phonePaused();
    phone.paused = false;
    flow.phoneResumed();
    flow.phoneReady();
    await settle();
    assert.deepEqual(asker.spoken, []);
  });

  it('stops when the voice fails', async () => {
    const { flow, asker, log } = setUp();
    asker.failing = true;
    flow.phoneReady();
    await settle();
    assert.equal(flow.running, false);
    assert.deepEqual(log, ['Could not read: say failed']);
  });

  it('starts on join with a text edited before the phone came', async () => {
    const { flow, asker } = setUp();
    flow.replaceText(['Only paragraph.']);
    flow.phoneReady();
    await settle();
    assert.deepEqual(asker.spoken, ['Only paragraph.']);
  });

  it('stops for a new text and waits for Start once it has read', async () => {
    const { flow, asker } = setUp();
    flow.phoneReady();
    await settle();
    flow.replaceText(['Only paragraph.']);
    assert.equal(flow.running, false);
    assert.equal(flow.run.text, 'Only paragraph.');
    flow.phoneReady();
    await settle();
    assert.deepEqual(asker.spoken, [PARAGRAPHS[0]]);
  });

  it('fetches the current paragraph ahead of time', () => {
    const { flow, asker } = setUp();
    flow.prefetchCurrent();
    assert.deepEqual(asker.prefetched, [PARAGRAPHS[0]]);
  });
});
