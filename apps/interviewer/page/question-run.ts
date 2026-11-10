export const parseScript = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export class QuestionRun {
  readonly questions: readonly string[];
  readonly #asked = new Set<number>();
  #current = 0;

  constructor(questions: readonly string[]) {
    this.questions = questions;
  }

  get current(): number {
    return this.#current;
  }

  get text(): string {
    return this.questions[this.#current] ?? '';
  }

  get asked(): ReadonlySet<number> {
    return this.#asked;
  }

  get isAsked(): boolean {
    return this.#asked.has(this.#current);
  }

  get isFirst(): boolean {
    return this.#current === 0;
  }

  get isLast(): boolean {
    return this.#current === this.questions.length - 1;
  }

  hasNext(loop: boolean): boolean {
    return !this.isLast || loop;
  }

  markAsked(): void {
    this.#asked.add(this.#current);
  }

  select(index: number): void {
    this.#current = index;
  }

  previous(): void {
    if (!this.isFirst) this.#current -= 1;
  }

  next(loop: boolean): boolean {
    if (!this.isLast) {
      this.#current += 1;
      return true;
    }
    if (!loop) return false;
    this.#current = 0;
    this.#asked.clear();
    return true;
  }
}
