import type { DemoLine, DemoSpeaker } from './demo-script.ts';
import { errorText, firstWords } from './labels.ts';
import type { QuestionFlowHost } from './question-flow.ts';
import type { Settings } from './settings-store.ts';
import type { SpeechPlayer } from './speech-player.ts';
import { TalkClock } from './talk-clock.ts';
import { TalkLifecycle, type TalkSteps } from './talk-lifecycle.ts';

export const ANSWER_GAP_MS = 800;
export const QUESTION_GAP_MS = 1500;
const GAP_BEFORE: Record<DemoSpeaker, number> = {
  guest: ANSWER_GAP_MS,
  interviewer: QUESTION_GAP_MS,
};
const NO_LINE: DemoLine = { speaker: 'interviewer', text: '' };

type VoicePlayer = Pick<SpeechPlayer, 'sounding' | 'speak' | 'stop' | 'prefetch'>;
export interface DemoPlayers {
  interviewer: VoicePlayer;
  guest: VoicePlayer;
}
/** Runs `action` after `ms` and returns a cancel; tests pass their own. */
export type Schedule = (action: () => void, ms: number) => () => void;

const later: Schedule = (action, ms) => {
  const timer = setTimeout(action, ms);
  return () => clearTimeout(timer);
};

export class DemoFlow {
  readonly #lines: readonly DemoLine[];
  readonly #players: DemoPlayers;
  readonly #host: QuestionFlowHost;
  readonly #schedule: Schedule;
  readonly #talk: TalkLifecycle;
  #clock = new TalkClock();
  #current = 0;
  #cancelGap = () => {};

  constructor(
    lines: readonly DemoLine[],
    players: DemoPlayers,
    host: QuestionFlowHost,
    now = () => performance.now(),
    schedule = later,
  ) {
    this.#lines = lines;
    this.#players = players;
    this.#host = host;
    this.#schedule = schedule;
    this.#talk = new TalkLifecycle(host, this.#steps(), now);
  }

  get lines(): readonly DemoLine[] {
    return this.#lines;
  }

  get current(): number {
    return this.#current;
  }

  get line(): DemoLine {
    return this.#lines[this.#current] ?? NO_LINE;
  }

  get running(): boolean {
    return this.#talk.running;
  }

  get finished(): boolean {
    return this.#talk.finished;
  }

  get sounding(): boolean {
    return this.#players[this.line.speaker].sounding;
  }

  elapsedMs(now: number): number {
    return this.#clock.elapsedMs(now);
  }

  get #settings(): Settings {
    return this.#host.settings();
  }

  get #next(): number {
    return (this.#current + 1) % this.#lines.length;
  }

  get #nextLine(): DemoLine {
    return this.#lines[this.#next] ?? NO_LINE;
  }

  // The time never cuts an answer: after the question or a part of it, the guest goes on.
  get #answerFollows(): boolean {
    return this.#nextLine.speaker === 'guest';
  }

  toggle(): void {
    this.#talk.toggle();
  }

  holdAutoStart(): void {
    this.#talk.holdAutoStart();
  }

  prefetchCurrent(): void {
    this.#prefetch(this.line);
  }

  lineSpoken(): void {
    if (!this.#talk.running || this.#talk.waitsForPhone) return;
    if (this.#talk.timeUp && !this.#answerFollows) {
      this.#talk.finish('Demo');
      return;
    }
    this.#current = this.#next;
    this.#cancelGap = this.#schedule(() => void this.#say(), GAP_BEFORE[this.line.speaker]);
    this.#host.changed();
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

  #steps(): TalkSteps {
    return {
      clock: () => this.#clock,
      restart: () => {
        this.#clock = new TalkClock();
        this.#current = 0;
      },
      say: () => void this.#say(),
      silence: () => this.#silence(),
    };
  }

  #silence(): void {
    this.#cancelGap();
    this.#players.interviewer.stop();
    this.#players.guest.stop();
  }

  #voiceName(speaker: DemoSpeaker): string {
    const { voice, guestVoice } = this.#settings;
    return speaker === 'guest' ? guestVoice : voice;
  }

  #prefetch({ speaker, text }: DemoLine): void {
    this.#players[speaker].prefetch(text, this.#voiceName(speaker));
  }

  async #say(): Promise<void> {
    const { current, line } = this;
    const next = this.#nextLine;
    this.#host.changed();
    try {
      if (await this.#players[line.speaker].speak(line.text, this.#voiceName(line.speaker))) {
        this.#host.log(`Demo ${current + 1}, ${line.speaker}: ${firstWords(line.text)}`);
        this.#prefetch(next);
      }
    } catch (error) {
      this.#host.log(`Could not speak: ${errorText(error)}`);
      this.stop();
    }
    this.#host.changed();
  }
}
