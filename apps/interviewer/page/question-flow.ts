import type { Asker } from './asker.ts';
import { errorText } from './labels.ts';
import { QuestionRun } from './question-run.ts';
import { QuietTimer } from './quiet-timer.ts';
import type { Settings } from './settings-store.ts';

export interface QuestionFlowHost {
  settings(): Settings;
  readonly guest: boolean;
  readonly phone: { readonly ready: boolean; readonly paused: boolean };
  log(message: string): void;
  changed(): void;
}

type Speaker = Pick<Asker, 'speaking' | 'speak' | 'stop' | 'prefetch'>;

export class QuestionFlow {
  readonly quiet = new QuietTimer();
  readonly #asker: Speaker;
  readonly #host: QuestionFlowHost;
  #run: QuestionRun;
  #reaskOnResume = false;
  #autoStartHeld = false;

  constructor(questions: readonly string[], asker: Speaker, host: QuestionFlowHost) {
    this.#run = new QuestionRun(questions);
    this.#asker = asker;
    this.#host = host;
  }

  get run(): QuestionRun {
    return this.#run;
  }

  get #settings(): Settings {
    return this.#host.settings();
  }

  get #isLive(): boolean {
    const { phone } = this.#host;
    return phone.ready && !phone.paused;
  }

  get #voiceAsks(): boolean {
    return this.#settings.asker === 'voice';
  }

  get #autoStartPending(): boolean {
    return (
      this.#settings.startOnJoin &&
      !this.#host.guest &&
      !this.#autoStartHeld &&
      this.#run.asked.size === 0
    );
  }

  holdAutoStart(): void {
    this.#autoStartHeld = true;
  }

  toggleAsk(): void {
    if (!this.#asker.speaking) return void this.#ask();
    this.stop();
    this.#host.changed();
  }

  previous(): void {
    this.#move(() => this.#run.previous());
  }

  select(index: number): void {
    this.#move(() => this.#run.select(index));
  }

  next(): void {
    this.stop();
    this.#run.next(this.#settings.loop);
    if (this.#isLive) void this.#ask();
    else this.#host.changed();
  }

  replaceScript(questions: readonly string[]): void {
    this.stop();
    this.#run = new QuestionRun(questions);
  }

  prefetchCurrent(): void {
    this.#prefetch(this.#run.current);
  }

  questionSpoken(): void {
    this.#armQuiet();
    this.#host.changed();
  }

  stop(): void {
    this.#asker.stop();
    this.quiet.disarm();
  }

  phoneReady(): void {
    if (this.#autoStartPending && !this.#host.phone.paused) void this.#ask();
  }

  phonePaused(): void {
    this.#reaskOnResume = this.#asker.speaking;
    this.stop();
  }

  phoneResumed(): void {
    const reask = this.#reaskOnResume;
    this.#reaskOnResume = false;
    if (reask || this.#autoStartPending) void this.#ask();
    else if (this.#run.isAsked) this.#armQuiet();
  }

  phoneLeft(): void {
    this.#reaskOnResume = false;
    this.stop();
  }

  tick(level: number, now: number): void {
    if (!this.#host.phone.paused) this.quiet.sample(level, now);
    if (!this.#asker.speaking && this.quiet.isDue(now, this.#settings.quietSec))
      this.#advanceAfterQuiet();
  }

  async #ask(): Promise<void> {
    this.stop();
    this.#run.markAsked();
    this.#host.changed();
    if (!this.#voiceAsks) return;
    const { current, text } = this.#run;
    try {
      if (await this.#asker.speak(text, this.#settings.voice)) {
        this.#host.log(`Asked ${current + 1}: ${text}`);
        this.#prefetch(current + 1);
      }
    } catch (error) {
      this.#host.log(`Could not ask: ${errorText(error)}`);
    }
    this.#host.changed();
  }

  #move(step: () => void): void {
    this.stop();
    step();
    this.#host.changed();
  }

  #advanceAfterQuiet(): void {
    this.quiet.disarm();
    if (this.#run.next(this.#settings.loop)) void this.#ask();
  }

  #armQuiet(): void {
    if (this.#isLive && this.#voiceAsks && this.#run.hasNext(this.#settings.loop))
      this.quiet.arm(performance.now());
  }

  #prefetch(index: number): void {
    const text = this.#run.questions[index];
    if (text !== undefined && this.#voiceAsks) this.#asker.prefetch(text, this.#settings.voice);
  }
}
