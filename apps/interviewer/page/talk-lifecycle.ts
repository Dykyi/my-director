import { formatMinutes } from './labels.ts';
import type { QuestionFlowHost } from './question-flow.ts';
import { talkLimitMs, type TalkClock } from './talk-clock.ts';

const MS_PER_SECOND = 1000;

type Clock = Pick<TalkClock, 'resume' | 'pause' | 'elapsedMs' | 'isDone'>;

export interface TalkSteps {
  /** The clock of the current run; a restart may replace it. */
  clock(): Clock;
  restart(): void;
  say(): void;
  silence(): void;
}

/** When a talk runs: from the join or Start, waiting for the phone, counting only recorded time. */
export class TalkLifecycle {
  readonly #host: QuestionFlowHost;
  readonly #steps: TalkSteps;
  readonly #now: () => number;
  #running = false;
  #finished = false;
  #autoStartDone = false;
  #waitsForPhone = false;

  constructor(host: QuestionFlowHost, steps: TalkSteps, now: () => number) {
    this.#host = host;
    this.#steps = steps;
    this.#now = now;
  }

  get running(): boolean {
    return this.#running;
  }

  /** The last run stopped by itself at the set time, not on Stop or a mode switch. */
  get finished(): boolean {
    return this.#finished;
  }

  /** Paused or away mid-talk, so the cut-off line waits for the phone. */
  get waitsForPhone(): boolean {
    return this.#waitsForPhone;
  }

  get timeUp(): boolean {
    const limitMs = talkLimitMs(this.#host.settings().talkMinutes);
    return this.#steps.clock().isDone(this.#now(), limitMs);
  }

  get #isLive(): boolean {
    const { phone } = this.#host;
    return phone.ready && !phone.paused;
  }

  get #autoStartPending(): boolean {
    return this.#host.settings().startOnJoin && !this.#host.guest && !this.#autoStartDone;
  }

  toggle(): void {
    if (this.#running) this.stop();
    else if (this.#isLive) this.#start();
    this.#host.changed();
  }

  holdAutoStart(): void {
    this.#autoStartDone = true;
  }

  stop(): void {
    this.#steps.silence();
    this.#running = false;
    this.#finished = false;
    this.#waitsForPhone = false;
    this.#syncClock();
  }

  finish(name: string): void {
    const elapsed = formatMinutes(this.#steps.clock().elapsedMs(this.#now()) / MS_PER_SECOND);
    this.stop();
    this.#finished = true;
    this.#host.log(`${name} finished after ${elapsed}`);
    this.#host.changed();
  }

  phoneReady(): void {
    if (this.#autoStartPending && this.#isLive) this.#start();
    else this.#goOn();
  }

  phonePaused(): void {
    this.#steps.silence();
    this.#waitsForPhone = this.#running;
    this.#syncClock();
  }

  phoneResumed(): void {
    this.phoneReady();
  }

  // A phone that leaves mid-talk usually comes back, so the talk waits as for a pause.
  phoneLeft(): void {
    this.phonePaused();
  }

  #start(): void {
    this.#steps.restart();
    this.#running = true;
    this.#finished = false;
    this.#autoStartDone = true;
    this.#syncClock();
    this.#steps.say();
  }

  // The line cut off by a pause or a leave, or still waiting to be said, starts from its beginning.
  #goOn(): void {
    this.#syncClock();
    if (!this.#waitsForPhone || !this.#isLive) return;
    this.#waitsForPhone = false;
    this.#steps.say();
  }

  #syncClock(): void {
    const now = this.#now();
    const clock = this.#steps.clock();
    if (this.#running && this.#isLive) clock.resume(now);
    else clock.pause(now);
  }
}
