import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { QuestionFlow } from './question-flow.ts';
import { DEFAULT_SETTINGS, type Settings } from './settings-store.ts';

const QUESTIONS = ['First?', 'Second?', 'Third?'];
const QUIET_MS = DEFAULT_SETTINGS.quietSec * 1000;
const settle = () => new Promise((resolve) => setImmediate(resolve));

class FakeAsker {
  speaking = false;
  spoken: string[] = [];
  prefetched: string[] = [];
  async speak(text: string): Promise<boolean> {
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
  const settings = { ...DEFAULT_SETTINGS, ...overrides };
  const log: string[] = [];
  const flow = new QuestionFlow(QUESTIONS, asker, {
    settings: () => settings,
    guest,
    phone,
    log: (message) => log.push(message),
    changed: () => {},
  });
  const finishSpeaking = () => {
    asker.speaking = false;
    flow.questionSpoken();
  };
  return { flow, asker, phone, log, finishSpeaking };
}

describe('QuestionFlow', () => {
  it('asks the first question once the phone is ready', async () => {
    const { flow, asker, log } = setUp();
    flow.phoneReady();
    await settle();
    assert.deepEqual(asker.spoken, ['First?']);
    assert.deepEqual([...flow.run.asked], [0]);
    assert.deepEqual(log, ['Asked 1: First?']);
    assert.deepEqual(asker.prefetched, ['Second?']);
  });

  it('waits for Ask when the questions do not start on join, and for a guest', () => {
    const manual = setUp({ startOnJoin: false });
    manual.flow.phoneReady();
    assert.deepEqual(manual.asker.spoken, []);
    const guest = setUp({}, true);
    guest.flow.phoneReady();
    assert.deepEqual(guest.asker.spoken, []);
  });

  it('moves to the next question after quiet from the phone', async () => {
    const { flow, asker, finishSpeaking } = setUp();
    flow.phoneReady();
    finishSpeaking();
    assert.equal(flow.quiet.armed, true);
    flow.tick(0, performance.now() + QUIET_MS - 1_000);
    assert.equal(flow.run.current, 0);
    flow.tick(0, performance.now() + QUIET_MS + 1_000);
    await settle();
    assert.equal(flow.run.current, 1);
    assert.deepEqual(asker.spoken, ['First?', 'Second?']);
  });

  it('stays on the last question unless the script loops', () => {
    const { flow, asker, finishSpeaking } = setUp();
    flow.select(2);
    void flow.toggleAsk();
    finishSpeaking();
    assert.equal(flow.quiet.armed, false);
    flow.tick(0, performance.now() + QUIET_MS * 2);
    assert.deepEqual(asker.spoken, ['Third?']);

    const looping = setUp({ loop: true });
    looping.flow.select(2);
    void looping.flow.toggleAsk();
    looping.finishSpeaking();
    assert.equal(looping.flow.quiet.armed, true);
  });

  it('reads a question again when a pause cut it off', () => {
    const { flow, asker, phone } = setUp();
    flow.phoneReady();
    phone.paused = true;
    flow.phonePaused();
    assert.equal(asker.speaking, false);
    phone.paused = false;
    flow.phoneResumed();
    assert.deepEqual(asker.spoken, ['First?', 'First?']);
  });

  it('only waits for quiet again when the pause came after the question', () => {
    const { flow, asker, phone, finishSpeaking } = setUp();
    flow.phoneReady();
    finishSpeaking();
    phone.paused = true;
    flow.phonePaused();
    assert.equal(flow.quiet.armed, false);
    phone.paused = false;
    flow.phoneResumed();
    assert.deepEqual(asker.spoken, ['First?']);
    assert.equal(flow.quiet.armed, true);
  });

  it('moves only the prompter on Next while the phone is paused', () => {
    const { flow, asker, phone } = setUp();
    phone.paused = true;
    flow.next();
    assert.equal(flow.run.current, 1);
    assert.deepEqual(asker.spoken, []);
    phone.paused = false;
    flow.next();
    assert.equal(flow.run.current, 2);
    assert.deepEqual(asker.spoken, ['Third?']);
  });

  it('marks the question asked without speaking when the microphone asks', () => {
    const { flow, asker } = setUp({ asker: 'microphone' });
    void flow.toggleAsk();
    assert.deepEqual(asker.spoken, []);
    assert.equal(flow.run.isAsked, true);
  });

  it('starts over with a new script', () => {
    const { flow } = setUp();
    void flow.toggleAsk();
    flow.replaceScript(['Only?']);
    assert.deepEqual(flow.run.questions, ['Only?']);
    assert.equal(flow.run.asked.size, 0);
  });
});
