import type { Asker } from './asker.ts';
import { errorText, firstWords } from './labels.ts';
import type { QuestionFlowHost } from './question-flow.ts';
import { ReadingRun } from './reading-run.ts';
import type { Settings } from './settings-store.ts';
import { TalkLifecycle, type TalkSteps } from './talk-lifecycle.ts';

type Speaker = Pick<Asker, 'speak' | 'stop' | 'prefetch'>;

export class ReadingFlow {
  readonly #asker: Speaker;
  readonly #host: QuestionFlowHost;
  readonly #talk: TalkLifecycle;
  #run: ReadingRun;

  constructor(
    paragraphs: readonly string[],
    asker: Speaker,
    host: QuestionFlowHost,
    now = () => performance.now(),
  ) {
    this.#run = new ReadingRun(paragraphs);
    this.#asker = asker;
    this.#host = host;
    this.#talk = new TalkLifecycle(host, this.#steps(), now);
  }

  get run(): ReadingRun {
    return this.#run;
  }

  get running(): boolean {
    return this.#talk.running;
  }

  get #settings(): Settings {
    return this.#host.settings();
  }

  toggle(): void {
    this.#talk.toggle();
  }

  replaceText(paragraphs: readonly string[]): void {
    this.stop();
    this.#run = new ReadingRun(paragraphs);
  }

  holdAutoStart(): void {
    this.#talk.holdAutoStart();
  }

  prefetchCurrent(): void {
    this.#asker.prefetch(this.#run.text, this.#settings.voice);
  }

  paragraphSpoken(): void {
    if (!this.#talk.running) return;
    if (this.#talk.timeUp) {
      this.#talk.finish('Reading');
      return;
    }
    this.#run.advance();
    void this.#read();
  }

  stop(): void {
    this.#talk.stop();
  }

  phoneReady(): void {
    this.#talk.phoneReady();
  }

  phonePaused(): void {
    this.#talk.phonePaused();
  }

  phoneResumed(): void {
    this.#talk.phoneResumed();
  }

  phoneLeft(): void {
    this.#talk.phoneLeft();
  }

  // A new run starts over with its own clock, so the reading clock lives in the run.
  #steps(): TalkSteps {
    return {
      clock: () => this.#run,
      restart: () => {
        this.#run = new ReadingRun(this.#run.paragraphs);
      },
      say: () => void this.#read(),
      silence: () => this.#asker.stop(),
    };
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
