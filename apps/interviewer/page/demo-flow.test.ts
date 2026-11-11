import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ANSWER_GAP_MS, DemoFlow, QUESTION_GAP_MS, type Schedule } from './demo-flow.ts';
import type { DemoLine } from './demo-script.ts';
import { DEFAULT_SETTINGS, type Settings } from './settings-store.ts';

const LINES: DemoLine[] = [
  { speaker: 'interviewer', text: 'Who are you and what do you do?' },
  { speaker: 'guest', text: 'I fix bikes.' },
  { speaker: 'interviewer', text: 'Why bikes?' },
  { speaker: 'guest', text: 'They are honest machines.' },
];
const MINUTE_MS = 60_000;
const settle = () => new Promise((resolve) => setImmediate(resolve));

class FakePlayer {
  sounding = false;
  failing = false;
  prefetched: string[] = [];
  readonly #said: string[];
  constructor(said: string[]) {
    this.#said = said;
  }
  async speak(text: string, voice: string): Promise<boolean> {
    if (this.failing) throw new Error('say failed');
    this.sounding = true;
    this.#said.push(`${voice}: ${text}`);
    return true;
  }
  stop(): void {
    this.sounding = false;
  }
  prefetch(text: string, voice: string): void {
    this.prefetched.push(`${voice}: ${text}`);
  }
}

/** Keeps each planned line until the test runs it. */
class FakeSchedule {
  planned: { action: () => void; ms: number }[] = [];
  readonly schedule: Schedule = (action, ms) => {
    const plan = { action, ms };
    this.planned.push(plan);
    return () => (this.planned = this.planned.filter((other) => other !== plan));
  };
  async run(): Promise<void> {
    this.planned.shift()?.action();
    await settle();
  }
}

function setUp(overrides: Partial<Settings> = {}, guest = false, lines = LINES) {
  const said: string[] = [];
  const players = { interviewer: new FakePlayer(said), guest: new FakePlayer(said) };
  const phone = { ready: true, paused: false };
  const settings: Settings = { ...DEFAULT_SETTINGS, mode: 'demo', ...overrides };
  const log: string[] = [];
  const clock = { now: 0 };
  const gaps = new FakeSchedule();
  const host = {
    settings: () => settings,
    guest,
    phone,
    log: (message: string) => log.push(message),
    changed: () => {},
  };
  const flow = new DemoFlow(lines, players, host, () => clock.now, gaps.schedule);
  const finishLine = async (atMs: number) => {
    clock.now = atMs;
    players[flow.line.speaker].sounding = false;
    flow.lineSpoken();
    await settle();
  };
  return { flow, players, said, phone, log, clock, gaps, finishLine };
}

describe('DemoFlow', () => {
  it('asks the first line once the phone is ready and fetches the answer in the guest voice', async () => {
    const { flow, players, said, log } = setUp();
    flow.phoneReady();
    await settle();
    assert.equal(flow.running, true);
    assert.equal(flow.sounding, true);
    assert.deepEqual(said, ['Samantha: Who are you and what do you do?']);
    assert.deepEqual(players.guest.prefetched, ['Daniel: I fix bikes.']);
    assert.deepEqual(log, ['Demo 1, interviewer: Who are you and what do…']);
  });

  it('answers in the guest voice after a short gap', async () => {
    const { flow, said, log, gaps, finishLine } = setUp();
    flow.phoneReady();
    await settle();
    await finishLine(MINUTE_MS);
    assert.deepEqual(
      gaps.planned.map(({ ms }) => ms),
      [ANSWER_GAP_MS],
    );
    assert.equal(flow.sounding, false);
    assert.equal(said.length, 1);
    await gaps.run();
    assert.equal(flow.sounding, true);
    assert.equal(said.at(-1), 'Daniel: I fix bikes.');
    assert.equal(log.at(-1), 'Demo 2, guest: I fix bikes.');
  });

  it('asks the next question a longer gap after the answer', async () => {
    const { flow, players, gaps, finishLine } = setUp();
    flow.phoneReady();
    await settle();
    await finishLine(MINUTE_MS);
    await gaps.run();
    await finishLine(2 * MINUTE_MS);
    assert.deepEqual(
      gaps.planned.map(({ ms }) => ms),
      [QUESTION_GAP_MS],
    );
    assert.deepEqual(players.interviewer.prefetched, ['Samantha: Why bikes?']);
  });

  it('starts the dialog over after its last line', async () => {
    const { flow, said, gaps, finishLine } = setUp();
    flow.phoneReady();
    await settle();
    for (let line = 1; line <= LINES.length; line += 1) {
      await finishLine(line * MINUTE_MS);
      await gaps.run();
    }
    assert.equal(flow.current, 0);
    assert.equal(said.at(-1), 'Samantha: Who are you and what do you do?');
    assert.equal(said.length, LINES.length + 1);
  });

  it('stops after the answer that reaches the limit', async () => {
    const { flow, said, log, gaps, finishLine } = setUp();
    flow.phoneReady();
    await settle();
    await finishLine(4 * MINUTE_MS);
    await gaps.run();
    assert.equal(flow.running, true);
    await finishLine(10 * MINUTE_MS);
    assert.equal(flow.running, false);
    assert.deepEqual(gaps.planned, []);
    assert.equal(said.length, 2);
    assert.equal(log.at(-1), 'Demo finished after 10:00');
  });

  it('goes on to the answer when the time runs out during a question, then stops', async () => {
    const { flow, said, log, gaps, finishLine } = setUp();
    flow.phoneReady();
    await settle();
    await finishLine(10 * MINUTE_MS);
    assert.equal(flow.running, true);
    assert.deepEqual(
      gaps.planned.map(({ ms }) => ms),
      [ANSWER_GAP_MS],
    );
    await gaps.run();
    assert.equal(said.at(-1), 'Daniel: I fix bikes.');
    await finishLine(10.5 * MINUTE_MS);
    assert.equal(flow.running, false);
    assert.deepEqual(gaps.planned, []);
    assert.equal(log.at(-1), 'Demo finished after 10:30');
  });

  it('finishes an answer said in parts when the time runs out after its first part', async () => {
    const lines: DemoLine[] = [
      { speaker: 'interviewer', text: 'Why bikes?' },
      { speaker: 'guest', text: 'They are honest machines.' },
      { speaker: 'guest', text: 'And they last.' },
      { speaker: 'interviewer', text: 'Thanks.' },
    ];
    const { flow, said, log, gaps, finishLine } = setUp({}, false, lines);
    flow.phoneReady();
    await settle();
    await finishLine(MINUTE_MS);
    await gaps.run();
    await finishLine(10 * MINUTE_MS);
    assert.equal(flow.running, true);
    await gaps.run();
    assert.equal(said.at(-1), 'Daniel: And they last.');
    await finishLine(10.5 * MINUTE_MS);
    assert.equal(flow.running, false);
    assert.equal(log.at(-1), 'Demo finished after 10:30');
  });

  it('says it finished only after the set time, until it starts again', async () => {
    const { flow, gaps, finishLine } = setUp();
    flow.phoneReady();
    await settle();
    await finishLine(4 * MINUTE_MS);
    await gaps.run();
    assert.equal(flow.finished, false);
    await finishLine(10 * MINUTE_MS);
    assert.equal(flow.finished, true);
    flow.toggle();
    await settle();
    assert.deepEqual([flow.running, flow.finished], [true, false]);
    flow.toggle();
    assert.deepEqual([flow.running, flow.finished], [false, false]);
  });

  it('ignores a line that ends while the phone is paused and says it again on Resume', async () => {
    const { flow, said, phone, gaps } = setUp();
    flow.phoneReady();
    await settle();
    phone.paused = true;
    flow.phonePaused();
    flow.lineSpoken();
    await settle();
    assert.deepEqual(gaps.planned, []);
    assert.equal(said.length, 1);
    phone.paused = false;
    flow.phoneResumed();
    await settle();
    assert.equal(flow.current, 0);
    assert.deepEqual(
      said,
      [LINES[0], LINES[0]].map((line) => `Samantha: ${line?.text}`),
    );
  });

  it('drops the planned line on a pause and says it on Resume', async () => {
    const { flow, said, phone, gaps, finishLine } = setUp();
    flow.phoneReady();
    await settle();
    await finishLine(MINUTE_MS);
    phone.paused = true;
    flow.phonePaused();
    assert.deepEqual(gaps.planned, []);
    phone.paused = false;
    flow.phoneResumed();
    await settle();
    assert.equal(said.at(-1), 'Daniel: I fix bikes.');
    assert.equal(said.length, 2);
  });

  it('stops the answer on a pause and says it again from its start on Resume', async () => {
    const { flow, players, said, phone, gaps, finishLine } = setUp();
    flow.phoneReady();
    await settle();
    await finishLine(MINUTE_MS);
    await gaps.run();
    phone.paused = true;
    flow.phonePaused();
    assert.equal(players.guest.sounding, false);
    assert.equal(flow.sounding, false);
    phone.paused = false;
    flow.phoneResumed();
    flow.phoneReady();
    await settle();
    assert.deepEqual(said.slice(1), ['Daniel: I fix bikes.', 'Daniel: I fix bikes.']);
  });

  it('counts only the time the phone records', async () => {
    const { flow, phone, clock } = setUp();
    flow.phoneReady();
    await settle();
    clock.now = MINUTE_MS;
    phone.paused = true;
    flow.phonePaused();
    clock.now = 30 * MINUTE_MS;
    phone.paused = false;
    flow.phoneResumed();
    await settle();
    assert.equal(flow.elapsedMs(31 * MINUTE_MS), 2 * MINUTE_MS);
  });

  it('waits for Start on a guest page', () => {
    const { flow, said } = setUp({}, true);
    flow.phoneReady();
    assert.equal(flow.running, false);
    assert.deepEqual(said, []);
  });

  it('starts and stops on the button, starting over each time', async () => {
    const { flow, said, clock, gaps, finishLine } = setUp({ startOnJoin: false });
    flow.toggle();
    await settle();
    await finishLine(MINUTE_MS);
    flow.toggle();
    assert.equal(flow.running, false);
    assert.deepEqual(gaps.planned, []);
    clock.now = 2 * MINUTE_MS;
    flow.toggle();
    await settle();
    assert.equal(flow.current, 0);
    assert.equal(flow.elapsedMs(2 * MINUTE_MS), 0);
    assert.deepEqual(
      said,
      [LINES[0], LINES[0]].map((line) => `Samantha: ${line?.text}`),
    );
  });

  it('stops when the voice fails', async () => {
    const { flow, players, log } = setUp();
    players.interviewer.failing = true;
    flow.phoneReady();
    await settle();
    assert.equal(flow.running, false);
    assert.deepEqual(log, ['Could not speak: say failed']);
  });

  it('fetches the current line ahead of time', () => {
    const { flow, players } = setUp();
    flow.prefetchCurrent();
    assert.deepEqual(players.interviewer.prefetched, ['Samantha: Who are you and what do you do?']);
  });
});
