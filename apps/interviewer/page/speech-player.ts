import { fetchSpeech } from './server-api.ts';

/** Plays server speech on one element; a newer speak or a stop cancels an older one. */
export class SpeechPlayer {
  readonly #element: HTMLAudioElement;
  readonly #urls = new Map<string, Promise<string>>();
  #ticket = 0;
  #speaking = false;
  #sounding = false;

  constructor(element: HTMLAudioElement, onSpoken: () => void) {
    this.#element = element;
    element.addEventListener('ended', () => {
      this.#speaking = false;
      this.#sounding = false;
      onSpoken();
    });
  }

  get speaking(): boolean {
    return this.#speaking;
  }

  /** Only while the sound plays, so a subtitle never runs ahead of the voice. */
  get sounding(): boolean {
    return this.#sounding;
  }

  get progress(): { atSec: number; lengthSec: number } {
    return { atSec: this.#element.currentTime, lengthSec: this.#element.duration || 0 };
  }

  async speak(text: string, voice: string): Promise<boolean> {
    this.stop();
    const ticket = this.#ticket;
    this.#speaking = true;
    try {
      const url = await this.#speechUrl(text, voice);
      if (ticket !== this.#ticket) return false;
      this.#element.src = url;
      await this.#element.play();
      if (ticket !== this.#ticket) return false;
      this.#sounding = true;
      return true;
    } catch (error) {
      if (ticket !== this.#ticket) return false;
      this.#speaking = false;
      throw error;
    }
  }

  stop(): void {
    this.#ticket += 1;
    this.#element.pause();
    this.#speaking = false;
    this.#sounding = false;
  }

  prefetch(text: string, voice: string): void {
    this.#speechUrl(text, voice).catch(() => {});
  }

  #speechUrl(text: string, voice: string): Promise<string> {
    const key = `${voice}\n${text}`;
    let url = this.#urls.get(key);
    if (!url) {
      url = fetchSpeech(text, voice).then((blob) => URL.createObjectURL(blob));
      url.catch(() => this.#urls.delete(key));
      this.#urls.set(key, url);
    }
    return url;
  }
}
