import { Track, type RemoteTrack } from 'livekit-client';

import type { Voice } from '../server/voice-catalog.ts';
import { Asker } from './asker.ts';
import { CallRecorder } from './call-recorder.ts';
import {
  InterviewerView,
  type ChipLook,
  type SessionRow,
  type ViewActions,
  type ViewState,
} from './interviewer-view.ts';
import { formatClock, levelDb, orDash, pauseTitle, qualityOf, statsLine } from './labels.ts';
import { PhoneFeed } from './phone-feed.ts';
import { parseScript, QuestionRun } from './question-run.ts';
import { QuietTimer } from './quiet-timer.ts';
import { RoomSession, type RoomListener, type RoomNames } from './room-session.ts';
import { fetchDefaultScript, fetchRoomAccess, fetchVoices } from './server-api.ts';
import { SettingsStore, type Settings } from './settings-store.ts';
import { StatsCollector } from './stats-collector.ts';

const TICK_MS = 100;
const STATS_INTERVAL_MS = 1000;
const SAMPLE_RATE = 48000;
const MS_PER_SECOND = 1000;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const clockSince = (at: number) => formatClock((Date.now() - at) / MS_PER_SECOND);

export class Interviewer {
  readonly #store = new SettingsStore(localStorage);
  /** Created suspended; the Join click starts it, as browsers allow sound only after a click. */
  readonly #context = new AudioContext({ sampleRate: SAMPLE_RATE });
  readonly #quiet = new QuietTimer();
  readonly #recorder = new CallRecorder();
  readonly #stats = new StatsCollector();
  readonly #pauses = { count: 0, ms: 0 };
  /** `?as=producer` is one more person in the room: it watches, but never asks or records by itself. */
  readonly #guest = new URLSearchParams(location.search).get('as') ?? undefined;
  readonly #view: InterviewerView;
  readonly #asker: Asker;
  readonly #phone: PhoneFeed;
  #settings: Settings;
  #run: QuestionRun;
  #session: RoomSession | undefined;
  #joining = false;
  #cutOff = false;

  private constructor(voices: readonly Voice[], defaultScript: string) {
    this.#settings = this.#store.load();
    this.#run = new QuestionRun(parseScript(this.#store.loadScript() ?? defaultScript));
    this.#view = new InterviewerView(this.#actions(), voices, defaultScript);
    this.#asker = new Asker(this.#context, this.#view.speech, () => this.#spoken());
    this.#phone = new PhoneFeed(this.#context, this.#view.videoHost);
    this.#view.fillSettings(this.#settings);
    this.#render();
    setInterval(() => this.#tick(), TICK_MS);
    setInterval(
      () => void this.#stats.collect(this.#phone, this.#settings.statsCsv),
      STATS_INTERVAL_MS,
    );
  }

  static async start(): Promise<Interviewer> {
    const [voices, defaultScript] = await Promise.all([fetchVoices(), fetchDefaultScript()]);
    return new Interviewer(voices, defaultScript);
  }

  get #names(): RoomNames {
    const { room, identity, phone } = this.#settings;
    return this.#session?.names ?? { room, identity: this.#guest ?? identity, phone };
  }

  get #isLive(): boolean {
    return this.#phone.ready && !this.#phone.paused;
  }

  get #startsQuestions(): boolean {
    return this.#settings.startOnJoin && !this.#guest;
  }

  #actions(): ViewActions {
    return {
      toggleJoin: () => void (this.#session ? this.#leave() : this.#join()),
      join: () => void this.#join(),
      ask: () => this.#toggleAsk(),
      previous: () => this.#move(() => this.#run.previous()),
      next: () => this.#next(),
      select: (index) => this.#move(() => this.#run.select(index)),
      toggleRecording: () => this.#toggleRecording(),
      hear: (on) => this.#hear(on),
      settingsEdited: () => this.#settingsEdited(),
      saveScript: (text) => this.#saveScript(text),
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
      await this.#context.resume();
      const access = await fetchRoomAccess(names.room, names.identity);
      this.#session = await RoomSession.join(
        access,
        names,
        this.#asker.stream,
        this.#roomListener(),
      );
      this.#log(`Joined ${names.room} as ${names.identity}`);
      await this.#useAsker();
      this.#prefetch(this.#run.current);
    } catch (error) {
      this.#log(`Could not join: ${errorText(error)}`);
    } finally {
      this.#joining = false;
      this.#render();
    }
  }

  async #leave(): Promise<void> {
    await this.#session?.leave();
    this.#left();
  }

  #left(): void {
    const wasIn = Boolean(this.#session);
    this.#session = undefined;
    this.#phoneLeft();
    void this.#useAsker();
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
      left: () => this.#left(),
      log: (message) => this.#log(message),
    };
  }

  #phoneTrack(track: RemoteTrack, muted: boolean): void {
    this.#phone.add(track, this.#settings.hearPhone);
    this.#log(`The phone's ${track.kind} arrived`);
    if (track.kind === Track.Kind.Video && muted) this.#phonePaused();
    if (this.#phone.ready) this.#phoneReady();
    this.#render();
  }

  #phoneTrackEnded(track: RemoteTrack): void {
    this.#phone.remove(track);
    this.#stopRecording();
    this.#log(`The phone's ${track.kind} stopped`);
    this.#render();
  }

  #phoneReady(): void {
    if (this.#guest) return;
    if (this.#settings.recordOnJoin && this.#recorder.since === undefined) this.#startRecording();
    if (this.#startsQuestions && this.#run.asked.size === 0 && !this.#phone.paused)
      void this.#ask();
  }

  #phonePaused(): void {
    if (!this.#phone.pause()) return;
    this.#pauses.count += 1;
    this.#cutOff = this.#asker.speaking;
    this.#stopAsking();
    this.#log(`The phone paused: ${this.#session?.pauseReason || 'no reason shared'}`);
    this.#render();
  }

  #phoneResumed(): void {
    const pausedMs = this.#phone.resume();
    if (pausedMs === undefined) return;
    this.#pauses.ms += pausedMs;
    const cutOff = this.#cutOff;
    this.#cutOff = false;
    this.#log('The phone resumed');
    if (cutOff || (this.#startsQuestions && this.#run.asked.size === 0)) void this.#ask();
    else if (this.#run.isAsked) this.#armQuiet();
    this.#render();
  }

  #phoneLeft(): void {
    this.#pauses.ms += this.#phone.clear() ?? 0;
    this.#cutOff = false;
    this.#stopRecording();
    this.#stopAsking();
    this.#render();
  }

  async #ask(): Promise<void> {
    this.#stopAsking();
    this.#run.markAsked();
    this.#render();
    if (this.#settings.asker === 'microphone') return;
    const { current, text } = this.#run;
    try {
      if (await this.#asker.speak(text, this.#settings.voice)) {
        this.#log(`Asked ${current + 1}: ${text}`);
        this.#prefetch(current + 1);
      }
    } catch (error) {
      this.#log(`Could not ask: ${errorText(error)}`);
    }
    this.#render();
  }

  #toggleAsk(): void {
    if (!this.#asker.speaking) return void this.#ask();
    this.#stopAsking();
    this.#render();
  }

  #move(step: () => void): void {
    this.#stopAsking();
    step();
    this.#render();
  }

  #next(): void {
    this.#stopAsking();
    this.#run.next(this.#settings.loop);
    if (this.#isLive) void this.#ask();
    else this.#render();
  }

  #moveOn(): void {
    this.#quiet.disarm();
    if (this.#run.next(this.#settings.loop)) void this.#ask();
  }

  #spoken(): void {
    this.#armQuiet();
    this.#render();
  }

  #armQuiet(): void {
    const hasNext = !this.#run.isLast || this.#settings.loop;
    if (this.#isLive && this.#settings.asker === 'voice' && hasNext)
      this.#quiet.arm(performance.now());
  }

  #stopAsking(): void {
    this.#asker.stop();
    this.#quiet.disarm();
  }

  #prefetch(index: number): void {
    const text = this.#run.questions[index];
    if (text !== undefined && this.#settings.asker === 'voice')
      this.#asker.prefetch(text, this.#settings.voice);
  }

  #saveScript(text: string): void {
    const questions = parseScript(text);
    this.#stopAsking();
    this.#store.saveScript(questions.join('\n'));
    this.#run = new QuestionRun(questions);
    this.#log(`Script saved: ${questions.length} questions`);
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
    if (this.#recorder.since === undefined) this.#startRecording();
    else this.#stopRecording();
    this.#render();
  }

  #hear(on: boolean): void {
    this.#settings = { ...this.#settings, hearPhone: on };
    this.#store.save(this.#settings);
    this.#phone.hear(on);
  }

  #settingsEdited(): void {
    const before = this.#settings;
    this.#settings = this.#view.readSettings(before);
    this.#view.fillSettings(this.#settings);
    this.#store.save(this.#settings);
    if (this.#settings.asker !== before.asker) {
      this.#stopAsking();
      void this.#useAsker();
    }
    this.#prefetch(this.#run.current);
    this.#render();
  }

  async #useAsker(): Promise<void> {
    try {
      await this.#asker.useMicrophone(
        Boolean(this.#session) && this.#settings.asker === 'microphone',
      );
    } catch (error) {
      this.#log(`Microphone unavailable: ${errorText(error)}`);
    }
  }

  #tick(): void {
    const now = performance.now();
    const level = this.#phone.measure();
    if (!this.#phone.paused) this.#quiet.hear(level, now);
    if (!this.#asker.speaking && this.#quiet.isDue(now, this.#settings.quietSec)) this.#moveOn();
    this.#render();
  }

  #log(message: string): void {
    const line = `${new Date().toLocaleTimeString('en-GB')} ${message}`;
    this.#view.log(line);
    console.log(line);
  }

  #render(): void {
    this.#view.render(this.#state());
  }

  #state(): ViewState {
    const names = this.#names;
    const quality = this.#session?.quality ?? 'unknown';
    const { pausedAt } = this.#phone;
    const stats = this.#stats.latest;
    return {
      room: names.room,
      identity: names.identity,
      connection: this.#connection(names.phone),
      inRoom: Boolean(this.#session),
      joining: this.#joining,
      onJoin: this.#onJoinChips(),
      phone: {
        name: names.phone,
        video: Boolean(this.#phone.video),
        audio: Boolean(this.#phone.audio),
        quality,
        levelDb: levelDb(this.#phone.level),
        pause:
          pausedAt === undefined
            ? undefined
            : {
                title: pauseTitle(this.#session?.pauseReason ?? ''),
                meta: `paused for ${clockSince(pausedAt)}`,
              },
      },
      statsLine: this.#settings.statsOverlay
        ? statsLine({
            width: stats.frameWidth,
            height: stats.frameHeight,
            fps: stats.framesPerSecond,
            freezes: stats.freezeCount,
            bitrate: stats.bitrate,
          })
        : undefined,
      prompter: this.#prompter(),
      questions: { list: this.#run.questions, current: this.#run.current, asked: this.#run.asked },
      recording: this.#recording(),
      session: this.#sessionRows(names.phone, quality),
      canDownloadCsv: this.#stats.rowCount > 0,
    };
  }

  #connection(phoneName: string): { text: string; look: ChipLook } {
    if (this.#joining) return { text: 'Joining…', look: '' };
    if (!this.#session) return { text: 'Not in the room', look: '' };
    if (this.#session.reconnecting) return { text: 'Reconnecting', look: 'chip-paused' };
    if (!this.#phone.video)
      return { text: `Connected · waiting for ${phoneName}`, look: 'chip-live' };
    if (this.#phone.paused) return { text: `${phoneName} paused`, look: 'chip-paused' };
    return { text: `Live with ${phoneName}`, look: 'chip-live' };
  }

  #onJoinChips(): string[] {
    if (this.#guest) return [];
    const chips = [];
    if (this.#settings.startOnJoin) chips.push('Questions start on join');
    if (this.#settings.recordOnJoin) chips.push('Auto record on join');
    return chips;
  }

  #prompter(): ViewState['prompter'] {
    const run = this.#run;
    const { asker, voice, quietSec, loop } = this.#settings;
    const quietFor = Math.floor(this.#quiet.quietSec(performance.now()));
    return {
      label: `QUESTION ${run.current + 1} OF ${run.questions.length}`,
      text: run.text,
      state: this.#questionState(),
      quiet: this.#quiet.armed ? `Next one after ${quietSec} s of quiet · ${quietFor} s` : '',
      progress: run.asked.size / run.questions.length,
      askLabel: this.#asker.speaking ? 'Stop' : run.isAsked ? 'Ask again' : 'Ask',
      canAsk: Boolean(this.#session),
      canPrevious: !run.isFirst,
      canNext: !run.isLast || loop,
      voice: asker === 'voice' ? `${voice}, scripted` : 'Your microphone',
    };
  }

  #questionState(): string {
    if (this.#asker.speaking) {
      const { atSec, lengthSec } = this.#asker.progress;
      return `Asking · ${formatClock(atSec)} of ${formatClock(lengthSec)}`;
    }
    if (this.#phone.paused && this.#run.asked.size > 0) return 'Waits for the phone to resume';
    return this.#run.isAsked ? 'Asked' : '';
  }

  #recording(): ViewState['recording'] {
    const since = this.#recorder.since;
    if (since !== undefined) {
      const clock = clockSince(since);
      return { clock, label: `Stop and download · ${clock}`, enabled: true };
    }
    const canStart = this.#phone.ready;
    const waits = !canStart && this.#settings.recordOnJoin && !this.#guest;
    return {
      clock: undefined,
      label: waits ? 'Recording starts when the phone joins' : 'Start recording',
      enabled: canStart,
    };
  }

  #sessionRows(phoneName: string, quality: string): Record<SessionRow, string> {
    const stats = this.#stats.latest;
    const { joinedAt, pausedAt } = this.#phone;
    const since = this.#recorder.since;
    const pausedMs = this.#pauses.ms + (pausedAt === undefined ? 0 : Date.now() - pausedAt);
    return {
      phone: this.#phone.video ? `${phoneName}, ${qualityOf(quality).label}` : 'not here',
      inRoom: joinedAt === undefined ? '-' : clockSince(joinedAt),
      picture: `${orDash(stats.frameWidth)}×${orDash(stats.frameHeight)} · ${orDash(stats.framesPerSecond)} fps`,
      freezes: `${orDash(stats.freezeCount)} · ${(stats.totalFreezesDuration ?? 0).toFixed(1)} s`,
      lost: `${orDash(stats.videoPacketsLost)} / ${orDash(stats.audioPacketsLost)}`,
      pauses: `${this.#pauses.count} · ${formatClock(pausedMs / MS_PER_SECOND)}`,
      asked: `${this.#run.asked.size} of ${this.#run.questions.length}`,
      recording: since === undefined ? 'off' : clockSince(since),
      rows: String(this.#stats.rowCount),
    };
  }
}
