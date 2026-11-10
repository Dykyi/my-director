export class PauseClock {
  #pausedAt: number | undefined;
  #count = 0;
  #endedMs = 0;

  get pausedAt(): number | undefined {
    return this.#pausedAt;
  }

  get paused(): boolean {
    return this.#pausedAt !== undefined;
  }

  get count(): number {
    return this.#count;
  }

  totalMs(now: number): number {
    return this.#endedMs + (this.#pausedAt === undefined ? 0 : now - this.#pausedAt);
  }

  pause(now: number): boolean {
    if (this.paused) return false;
    this.#pausedAt = now;
    this.#count += 1;
    return true;
  }

  resume(now: number): boolean {
    if (this.#pausedAt === undefined) return false;
    this.#endedMs += now - this.#pausedAt;
    this.#pausedAt = undefined;
    return true;
  }
}
