import type { Asker } from './asker.ts';
import { errorText, formatMinutes } from './labels.ts';
import type { QuestionFlowHost } from './question-flow.ts';
import { readingLimitMs, ReadingRun } from './reading-run.ts';
import type { Settings } from './settings-store.ts';

const MS_PER_SECOND = 1000;
const LOGGED_WORDS = 6;

type Speaker = Pick<Asker, 'speak' | 'stop' | 'prefetch'>;

function firstWords(text: string): string {
  const words = text.split(' ');
  return words.length > LOGGED_WORDS ? `${words.slice(0, LOGGED_WORDS).join(' ')}…` : text;
}

export class ReadingFlow {
  readonly #asker: Speaker;
  readonly #host: QuestionFlowHost;
  readonly #now: () => number;
  #run: ReadingRun;
  #running = false;
  #autoStartDone = false;
  #waitsForPhone = false;

  constructor(
    paragraphs: readonly string[],
    asker: Speaker,
    host: QuestionFlowHost,
    now = () => performance.now(),
  ) {
    this.#run = new ReadingRun(paragraphs);
    this.#asker = asker;
    this.#host = host;
    this.#now = now;
  }

  get run(): ReadingRun {
    return this.#run;
  }

  get running(): boolean {
    return this.#running;
  }

  get #settings(): Settings {
    return this.#host.settings();
  }

  get #isLive(): boolean {
    const { phone } = this.#host;
    return phone.ready && !phone.paused;
  }

  get #autoStartPending(): boolean {
    return this.#settings.startOnJoin && !this.#host.guest && !this.#autoStartDone;
  }

  toggle(): void {
    if (this.#running) this.stop();
    else if (this.#isLive) this.#start();
    this.#host.changed();
  }

  replaceText(paragraphs: readonly string[]): void {
    this.stop();
    this.#run = new ReadingRun(paragraphs);
  }

  holdAutoStart(): void {
    this.#autoStartDone = true;
  }

  prefetchCurrent(): void {
    this.#asker.prefetch(this.#run.text, this.#settings.voice);
  }

  paragraphSpoken(): void {
    if (!this.#running) return;
    const now = this.#now();
    if (!this.#run.isDone(now, readingLimitMs(this.#settings.readingMinutes))) {
      this.#run.advance();
      void this.#read();
      return;
    }
    this.stop();
    const elapsed = formatMinutes(this.#run.elapsedMs(now) / MS_PER_SECOND);
    this.#host.log(`Reading finished after ${elapsed}`);
    this.#host.changed();
  }

  stop(): void {
    this.#asker.stop();
    this.#running = false;
    this.#waitsForPhone = false;
    this.#syncClock();
  }

  phoneReady(): void {
    if (this.#autoStartPending && this.#isLive) this.#start();
    else this.#goOn();
  }

  phonePaused(): void {
    this.#asker.stop();
    this.#waitsForPhone = this.#running;
    this.#syncClock();
  }

  phoneResumed(): void {
    this.phoneReady();
  }

  // A phone that leaves mid-reading usually comes back, so the reading waits as for a pause.
  phoneLeft(): void {
    this.phonePaused();
  }

  #start(): void {
    this.#run = new ReadingRun(this.#run.paragraphs);
    this.#running = true;
    this.#autoStartDone = true;
    this.#syncClock();
    void this.#read();
  }

  // The paragraph cut off by a pause or a leave is read again from its start.
  #goOn(): void {
    this.#syncClock();
    if (!this.#waitsForPhone || !this.#isLive) return;
    this.#waitsForPhone = false;
    void this.#read();
  }

  // The time runs only while the reading is on and the phone records it.
  #syncClock(): void {
    const now = this.#now();
    if (this.#running && this.#isLive) this.#run.resume(now);
    else this.#run.pause(now);
  }

  async #read(): Promise<void> {
    const { current, text, nextText } = this.#run;
    const { voice } = this.#settings;
    this.#host.changed();
    try {
      if (await this.#asker.speak(text, voice)) {
        this.#host.log(`Read ${current + 1}: ${firstWords(text)}`);
        this.#asker.prefetch(nextText, voice);
      }
    } catch (error) {
      this.#host.log(`Could not read: ${errorText(error)}`);
      this.stop();
    }
    this.#host.changed();
  }
}
