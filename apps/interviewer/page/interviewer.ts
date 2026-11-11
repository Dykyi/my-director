import { Track, type RemoteTrack } from 'livekit-client';

import type { Voice } from '../server/voice-catalog.ts';
import { Asker } from './asker.ts';
import { CallRecorder } from './call-recorder.ts';
import { InterviewerView, type ViewActions } from './interviewer-view.ts';
import { errorText } from './labels.ts';
import { PhoneFeed } from './phone-feed.ts';
import { QuestionFlow, type QuestionFlowHost } from './question-flow.ts';
import { parseScript } from './question-run.ts';
import { ReadingFlow } from './reading-flow.ts';
import { parseParagraphs } from './reading-run.ts';
import { RoomSession, type RoomListener, type RoomNames } from './room-session.ts';
import { fetchDefaultScript, fetchRoomAccess, fetchVoices } from './server-api.ts';
import { SettingsStore, type Settings } from './settings-store.ts';
import { StatsCollector } from './stats-collector.ts';
import { buildViewState } from './view-state.ts';

const REDRAW_MS = 100;
const STATS_INTERVAL_MS = 1000;
const SAMPLE_RATE = 48000;

type PhoneFlow = Pick<
  QuestionFlow,
  'phoneReady' | 'phonePaused' | 'phoneResumed' | 'phoneLeft' | 'prefetchCurrent' | 'holdAutoStart'
>;

export class Interviewer {
  readonly #store = new SettingsStore(localStorage);
  /** Created suspended; the Join click starts it, as browsers allow sound only after a click. */
  readonly #audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
  readonly #recorder = new CallRecorder();
  readonly #stats = new StatsCollector();
  /** `?as=producer` is one more person in the room: it watches, but never asks or records by itself. */
  readonly #guestName = new URLSearchParams(location.search).get('as') ?? undefined;
  readonly #view: InterviewerView;
  readonly #asker: Asker;
  readonly #phone: PhoneFeed;
  readonly #questions: QuestionFlow;
  readonly #reading: ReadingFlow;
  #settings: Settings;
  #session: RoomSession | undefined;
  #joining = false;

  private constructor(voices: readonly Voice[], defaultScript: string, defaultReading: string) {
    this.#settings = this.#store.load();
    this.#view = new InterviewerView(this.#actions(), voices, {
      script: defaultScript,
      reading: defaultReading,
    });
    this.#asker = new Asker(this.#audioContext, this.#view.speech, () => this.#spoken());
    this.#asker.hear(this.#settings.hearVoice);
    this.#phone = new PhoneFeed(this.#audioContext, this.#view.videoHost);
    const host: QuestionFlowHost = {
      settings: () => this.#settings,
      guest: Boolean(this.#guestName),
      phone: this.#phone,
      log: (message) => this.#log(message),
      changed: () => this.#render(),
    };
    const questions = parseScript(this.#store.loadScript() ?? defaultScript);
    this.#questions = new QuestionFlow(questions, this.#asker, host);
    const paragraphs = parseParagraphs(this.#store.loadReading() ?? defaultReading);
    this.#reading = new ReadingFlow(paragraphs, this.#asker, host);
    this.#view.fillSettings(this.#settings);
    this.#render();
    setInterval(() => this.#tick(), REDRAW_MS);
    setInterval(
      () => void this.#stats.collect(this.#phone, this.#settings.statsCsv),
      STATS_INTERVAL_MS,
    );
  }

  static async start(defaultReading: string): Promise<Interviewer> {
    const [voices, defaultScript] = await Promise.all([fetchVoices(), fetchDefaultScript()]);
    return new Interviewer(voices, defaultScript, defaultReading);
  }

  get #names(): RoomNames {
    const { room, identity, phone } = this.#settings;
    return this.#session?.names ?? { room, identity: this.#guestName ?? identity, phone };
  }

  get #inRoom(): boolean {
    return this.#session !== undefined;
  }

  get #flow(): PhoneFlow {
    return this.#settings.mode === 'reading' ? this.#reading : this.#questions;
  }

  // A mode switch stops the voice, so the voice that ended belongs to the current mode.
  #spoken(): void {
    if (this.#settings.mode === 'reading') this.#reading.paragraphSpoken();
    else this.#questions.questionSpoken();
  }

  #actions(): ViewActions {
    return {
      toggleJoin: () => void (this.#session ? this.#leave() : this.#join()),
      join: () => void this.#join(),
      ask: () => this.#questions.toggleAsk(),
      previous: () => this.#questions.previous(),
      next: () => this.#questions.next(),
      select: (index) => this.#questions.select(index),
      read: () => this.#reading.toggle(),
      toggleRecording: () => this.#toggleRecording(),
      hear: (on) => this.#setHearPhone(on),
      hearVoice: (on) => this.#setHearVoice(on),
      settingsEdited: () => this.#settingsEdited(),
      saveScript: (text) => this.#saveScript(text),
      saveReading: (text) => this.#saveReading(text),
      downloadCsv: () => this.#stats.download(),
      reset: () => {
        this.#store.reset();
        location.reload();
      },
    };
  }

  async #join(): Promise<void> {
    const names = this.#names;
    this.#joining = true;
    this.#render();
    try {
      await this.#audioContext.resume();
      const access = await fetchRoomAccess(names.room, names.identity);
      this.#session = await RoomSession.join(
        access,
        names,
        this.#asker.stream,
        this.#roomListener(),
      );
      this.#log(`Joined ${names.room} as ${names.identity}`);
      if (this.#session.phonePausedWithoutVideo) this.#phonePaused();
      await this.#syncMicrophone();
      this.#flow.prefetchCurrent();
    } catch (error) {
      this.#log(`Could not join: ${errorText(error)}`);
    } finally {
      this.#joining = false;
      this.#render();
    }
  }

  async #leave(): Promise<void> {
    await this.#session?.leave();
    this.#roomClosed();
  }

  #roomClosed(): void {
    const wasIn = this.#inRoom;
    this.#session = undefined;
    this.#phoneLeft();
    void this.#syncMicrophone();
    if (wasIn) this.#log('Left the room');
  }

  #roomListener(): RoomListener {
    return {
      phoneTrack: (track, muted) => this.#phoneTrack(track, muted),
      phoneTrackEnded: (track) => this.#phoneTrackEnded(track),
      phonePaused: () => this.#phonePaused(),
      phoneResumed: () => this.#phoneResumed(),
      phoneLeft: () => this.#phoneLeft(),
      changed: () => this.#render(),
      left: () => this.#roomClosed(),
      log: (message) => this.#log(message),
    };
  }

  #phoneTrack(track: RemoteTrack, muted: boolean): void {
    this.#phone.add(track, this.#settings.hearPhone);
    this.#log(`The phone's ${track.kind} arrived`);
    if (track.kind === Track.Kind.Video && muted) this.#phonePaused();
    if (this.#phone.ready) {
      // A phone paused without a picture publishes live tracks only on Resume.
      if (!this.#phone.video?.isMuted) this.#phoneResumed();
      this.#phoneReady();
    }
    this.#render();
  }

  #phoneTrackEnded(track: RemoteTrack): void {
    this.#phone.remove(track);
    this.#stopRecording();
    this.#log(`The phone's ${track.kind} stopped`);
    this.#render();
  }

  #phoneReady(): void {
    if (this.#guestName) return;
    if (this.#settings.recordOnJoin && !this.#recorder.recording) this.#startRecording();
    this.#flow.phoneReady();
  }

  #phonePaused(): void {
    if (!this.#phone.pause()) return;
    this.#flow.phonePaused();
    this.#log(`The phone paused: ${this.#session?.pauseReason || 'no reason shared'}`);
    this.#render();
  }

  #phoneResumed(): void {
    if (!this.#phone.resume()) return;
    this.#log('The phone resumed');
    this.#flow.phoneResumed();
    this.#render();
  }

  #phoneLeft(): void {
    this.#phone.clear();
    this.#stopRecording();
    this.#flow.phoneLeft();
    this.#render();
  }

  #saveScript(text: string): void {
    const questions = parseScript(text);
    this.#questions.replaceScript(questions);
    this.#store.saveScript(questions.join('\n'));
    this.#log(`Script saved: ${questions.length} questions`);
    this.#render();
  }

  #saveReading(text: string): void {
    const paragraphs = parseParagraphs(text);
    this.#reading.replaceText(paragraphs);
    this.#store.saveReading(paragraphs.join('\n\n'));
    this.#log(`Text saved: ${paragraphs.length} paragraphs`);
    this.#render();
  }

  #startRecording(): void {
    const received = this.#phone.media;
    if (received) this.#log(`Recording ${this.#recorder.start(received, this.#asker.stream)}`);
  }

  #stopRecording(): void {
    if (this.#recorder.stop()) this.#log('Recording stopped; the WebM files are in Downloads');
  }

  #toggleRecording(): void {
    if (!this.#recorder.recording) this.#startRecording();
    else this.#stopRecording();
    this.#render();
  }

  #setHearPhone(on: boolean): void {
    this.#settings = { ...this.#settings, hearPhone: on };
    this.#store.save(this.#settings);
    this.#phone.hear(on);
  }

  #setHearVoice(on: boolean): void {
    this.#settings = { ...this.#settings, hearVoice: on };
    this.#store.save(this.#settings);
    this.#asker.hear(on);
  }

  #settingsEdited(): void {
    const before = this.#settings;
    this.#settings = this.#view.readSettings(before);
    this.#view.fillSettings(this.#settings);
    this.#store.save(this.#settings);
    if (this.#settings.asker !== before.asker) {
      this.#questions.stop();
      void this.#syncMicrophone();
    }
    if (this.#settings.mode !== before.mode) {
      this.#questions.stop();
      this.#reading.stop();
      // The phone joined before this mode began, so it starts on Ask or Start, not on a resume.
      if (this.#phone.ready || this.#phone.paused) this.#flow.holdAutoStart();
    }
    this.#flow.prefetchCurrent();
    this.#render();
  }

  async #syncMicrophone(): Promise<void> {
    try {
      await this.#asker.useMicrophone(this.#inRoom && this.#settings.asker === 'microphone');
    } catch (error) {
      this.#log(`Microphone unavailable: ${errorText(error)}`);
    }
  }

  #tick(): void {
    const now = performance.now();
    this.#questions.tick(this.#phone.measure(), now);
    this.#render();
  }

  #log(message: string): void {
    const line = `${new Date().toLocaleTimeString('en-GB')} ${message}`;
    this.#view.log(line);
    console.log(line);
  }

  #render(): void {
    const page = {
      names: this.#names,
      guest: Boolean(this.#guestName),
      joining: this.#joining,
      session: this.#session,
      settings: this.#settings,
      phone: this.#phone,
      run: this.#questions.run,
      quiet: this.#questions.quiet,
      reading: this.#reading,
      asker: this.#asker,
      recorder: this.#recorder,
      stats: this.#stats,
    };
    this.#view.render(buildViewState(page, { wallMs: Date.now(), monotonicMs: performance.now() }));
  }
}
