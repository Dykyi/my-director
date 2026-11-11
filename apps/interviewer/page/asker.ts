import { SpeechPlayer } from './speech-player.ts';

// The voice and the microphone share one bus, so switching keeps the published track and the recording.
const stopTrack = (track: MediaStreamTrack) => track.stop();

export class Asker {
  readonly #context: AudioContext;
  readonly #bus: MediaStreamAudioDestinationNode;
  readonly #player: SpeechPlayer;
  #microphone: MediaStreamAudioSourceNode | undefined;
  #microphoneRequest = 0;
  readonly #voice: MediaElementAudioSourceNode;
  #heard = false;

  constructor(context: AudioContext, speech: HTMLAudioElement, onSpoken: () => void) {
    this.#context = context;
    this.#player = new SpeechPlayer(speech, onSpoken);
    this.#bus = context.createMediaStreamDestination();
    this.#voice = context.createMediaElementSource(speech);
    this.#voice.connect(this.#bus);
  }

  get stream(): MediaStream {
    return this.#bus.stream;
  }

  get speaking(): boolean {
    return this.#player.speaking;
  }

  get sounding(): boolean {
    return this.#player.sounding;
  }

  get progress(): { atSec: number; lengthSec: number } {
    return this.#player.progress;
  }

  speak(text: string, voice: string): Promise<boolean> {
    return this.#player.speak(text, voice);
  }

  // An element routed into the graph is silent here until it also reaches the speakers.
  hear(on: boolean): void {
    if (on === this.#heard) return;
    if (on) this.#voice.connect(this.#context.destination);
    else this.#voice.disconnect(this.#context.destination);
    this.#heard = on;
  }

  stop(): void {
    this.#player.stop();
  }

  prefetch(text: string, voice: string): void {
    this.#player.prefetch(text, voice);
  }

  async useMicrophone(on: boolean): Promise<void> {
    const request = ++this.#microphoneRequest;
    this.#microphone?.mediaStream.getTracks().forEach(stopTrack);
    this.#microphone?.disconnect();
    this.#microphone = undefined;
    if (!on) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    // A later call won while the browser opened this one.
    if (request !== this.#microphoneRequest) {
      stream.getTracks().forEach(stopTrack);
      return;
    }
    this.#microphone = this.#context.createMediaStreamSource(stream);
    this.#microphone.connect(this.#bus);
  }
}
