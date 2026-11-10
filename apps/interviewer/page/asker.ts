import { fetchSpeech } from './server-api.ts';

export class Asker {
  readonly #context: AudioContext;
  readonly #bus: MediaStreamAudioDestinationNode;
  readonly #speech: HTMLAudioElement;
  readonly #urls = new Map<string, Promise<string>>();
  #microphone: MediaStreamAudioSourceNode | undefined;
  #ticket = 0;
  #speaking = false;

  constructor(context: AudioContext, speech: HTMLAudioElement, onSpoken: () => void) {
    this.#context = context;
    this.#speech = speech;
    this.#bus = context.createMediaStreamDestination();
    context.createMediaElementSource(speech).connect(this.#bus);
    speech.addEventListener('ended', () => {
      this.#speaking = false;
      onSpoken();
    });
  }

  get stream(): MediaStream {
    return this.#bus.stream;
  }

  get speaking(): boolean {
    return this.#speaking;
  }

  get progress(): { atSec: number; lengthSec: number } {
    return { atSec: this.#speech.currentTime, lengthSec: this.#speech.duration || 0 };
  }

  async speak(text: string, voice: string): Promise<boolean> {
    this.stop();
    const ticket = this.#ticket;
    this.#speaking = true;
    try {
      const url = await this.#speechUrl(text, voice);
      if (ticket !== this.#ticket) return false;
      this.#speech.src = url;
      await this.#speech.play();
      return true;
    } catch (error) {
      if (ticket !== this.#ticket) return false;
      this.#speaking = false;
      throw error;
    }
  }

  stop(): void {
    this.#ticket += 1;
    this.#speech.pause();
    this.#speaking = false;
  }

  prefetch(text: string, voice: string): void {
    this.#speechUrl(text, voice).catch(() => {});
  }

  async useMicrophone(on: boolean): Promise<void> {
    this.#microphone?.mediaStream.getTracks().forEach((track) => track.stop());
    this.#microphone?.disconnect();
    this.#microphone = undefined;
    if (!on) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    this.#microphone = this.#context.createMediaStreamSource(stream);
    this.#microphone.connect(this.#bus);
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
