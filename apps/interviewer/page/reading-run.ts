import { MAX_SPEECH_CHARS } from '../server/requests.ts';
import { TalkClock } from './talk-clock.ts';

// The mark stays with its sentence and the space after it starts the next part.
const SENTENCE_END = /[.!?](?= )/g;

function cutIndex(head: string, max: number): number {
  const sentenceEnd = [...head.matchAll(SENTENCE_END)].at(-1)?.index;
  if (sentenceEnd !== undefined) return sentenceEnd + 1;
  const space = head.lastIndexOf(' ');
  return space > 0 ? space : max;
}

/** The speech service refuses longer text, so a long paragraph is read in parts. */
export function speechParts(paragraph: string, max = MAX_SPEECH_CHARS): string[] {
  const parts: string[] = [];
  let rest = paragraph;
  while (rest.length > max) {
    const cut = cutIndex(rest.slice(0, max + 1), max);
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return [...parts, rest];
}

export const parseParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .flatMap((paragraph) => speechParts(paragraph));

export class ReadingRun {
  readonly paragraphs: readonly string[];
  readonly #clock = new TalkClock();
  #current = 0;

  constructor(paragraphs: readonly string[]) {
    this.paragraphs = paragraphs;
  }

  get current(): number {
    return this.#current;
  }

  get text(): string {
    return this.paragraphs[this.#current] ?? '';
  }

  get nextText(): string {
    return this.paragraphs[this.#next] ?? '';
  }

  advance(): void {
    this.#current = this.#next;
  }

  resume(now: number): void {
    this.#clock.resume(now);
  }

  pause(now: number): void {
    this.#clock.pause(now);
  }

  elapsedMs(now: number): number {
    return this.#clock.elapsedMs(now);
  }

  isDone(now: number, limitMs: number): boolean {
    return this.#clock.isDone(now, limitMs);
  }

  get #next(): number {
    return (this.#current + 1) % this.paragraphs.length;
  }
}
