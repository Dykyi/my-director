/** Phone audio level (RMS, 0 to 1) above which it counts as someone speaking: about -40 dBFS. */
export const VOICE_LEVEL = 0.01;

/** A sound shorter than this (a click, a knock, the phone being touched) is not an answer. */
export const MIN_VOICE_MS = 300;

export class QuietTimer {
  #since: number | undefined;
  #voiceSince: number | undefined;

  get armed(): boolean {
    return this.#since !== undefined;
  }

  arm(at: number): void {
    this.#since = at;
  }

  disarm(): void {
    this.#since = undefined;
  }

  hear(level: number, at: number): void {
    if (level < VOICE_LEVEL) {
      this.#voiceSince = undefined;
      return;
    }
    this.#voiceSince ??= at;
    if (this.armed && at - this.#voiceSince >= MIN_VOICE_MS) this.#since = at;
  }

  quietSec(at: number): number {
    return this.#since === undefined ? 0 : (at - this.#since) / 1000;
  }

  isDue(at: number, quietSec: number): boolean {
    return this.armed && this.quietSec(at) >= quietSec;
  }
}
