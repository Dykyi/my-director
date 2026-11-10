import { Track, type RemoteTrack } from 'livekit-client';

import { rms } from './audio-level.ts';
import { PauseClock } from './pause-clock.ts';

const ANALYSER_SIZE = 2048;

interface PhoneAudio {
  track: RemoteTrack;
  element: HTMLMediaElement;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  samples: Float32Array<ArrayBuffer>;
}

export class PhoneFeed {
  readonly pauses = new PauseClock();
  readonly #context: AudioContext;
  readonly #videoHost: HTMLElement;
  #video: RemoteTrack | undefined;
  #audio: PhoneAudio | undefined;
  #joinedAt: number | undefined;
  #level = 0;

  constructor(context: AudioContext, videoHost: HTMLElement) {
    this.#context = context;
    this.#videoHost = videoHost;
  }

  get video(): RemoteTrack | undefined {
    return this.#video;
  }

  get audio(): RemoteTrack | undefined {
    return this.#audio?.track;
  }

  get ready(): boolean {
    return Boolean(this.#video && this.#audio);
  }

  get media(): MediaStream | undefined {
    if (!this.#video || !this.#audio) return undefined;
    return new MediaStream([this.#video.mediaStreamTrack, this.#audio.track.mediaStreamTrack]);
  }

  get joinedAt(): number | undefined {
    return this.#joinedAt;
  }

  get pausedAt(): number | undefined {
    return this.pauses.pausedAt;
  }

  get paused(): boolean {
    return this.pauses.paused;
  }

  get level(): number {
    return this.#level;
  }

  add(track: RemoteTrack, hearOnMac: boolean): void {
    this.#joinedAt ??= Date.now();
    if (track.kind === Track.Kind.Video) {
      this.#video = track;
      this.#videoHost.replaceChildren(track.attach());
      return;
    }
    // The analyser hears the phone even while its element is muted on this Mac.
    const element = track.attach();
    element.muted = !hearOnMac;
    document.body.append(element);
    const source = this.#context.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
    const analyser = this.#context.createAnalyser();
    analyser.fftSize = ANALYSER_SIZE;
    source.connect(analyser);
    this.#audio = { track, element, source, analyser, samples: new Float32Array(ANALYSER_SIZE) };
  }

  remove(track: RemoteTrack): void {
    track.detach().forEach((element) => element.remove());
    if (track === this.#video) this.#video = undefined;
    if (track === this.#audio?.track) {
      this.#audio.source.disconnect();
      this.#audio = undefined;
      this.#level = 0;
    }
  }

  hear(on: boolean): void {
    if (this.#audio) this.#audio.element.muted = !on;
  }

  measure(): number {
    if (!this.#audio) return 0;
    const { analyser, samples } = this.#audio;
    analyser.getFloatTimeDomainData(samples);
    this.#level = rms(samples);
    return this.#level;
  }

  pause(): boolean {
    return this.pauses.pause(Date.now());
  }

  resume(): boolean {
    return this.pauses.resume(Date.now());
  }

  clear(): void {
    this.resume();
    for (const track of [this.#video, this.#audio?.track]) if (track) this.remove(track);
    this.#joinedAt = undefined;
  }
}
