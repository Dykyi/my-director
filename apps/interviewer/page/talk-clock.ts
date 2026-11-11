const MS_PER_MINUTE = 60_000;

export const talkLimitMs = (minutes: number): number => minutes * MS_PER_MINUTE;

/** Time that runs only while a talk is on and the phone records it. */
export class TalkClock {
  #ms = 0;
  #since: number | undefined;

  resume(now: number): void {
    this.#since ??= now;
  }

  pause(now: number): void {
    if (this.#since === undefined) return;
    this.#ms += now - this.#since;
    this.#since = undefined;
  }

  elapsedMs(now: number): number {
    return this.#ms + (this.#since === undefined ? 0 : now - this.#since);
  }

  isDone(now: number, limitMs: number): boolean {
    return this.elapsedMs(now) >= limitMs;
  }
}
