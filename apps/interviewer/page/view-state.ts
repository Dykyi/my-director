import { levelDb } from './audio-level.ts';
import { formatClock, formatMinutes, orDash, pauseTitle, qualityOf, statsLine } from './labels.ts';
import type { PauseClock } from './pause-clock.ts';
import type { QuestionRun } from './question-run.ts';
import type { QuietTimer } from './quiet-timer.ts';
import { readingLimitMs, type ReadingRun } from './reading-run.ts';
import type { RoomNames } from './room-session.ts';
import type { FlowMode, Settings } from './settings-store.ts';
import type { PhoneStats } from './stats-collector.ts';

const MS_PER_SECOND = 1000;

export const SESSION_ROWS = {
  phone: 'Phone',
  inRoom: 'Phone in the room',
  picture: 'Picture',
  freezes: 'Freezes',
  lost: 'Packets lost, video / audio',
  pauses: 'Pauses',
  asked: 'Questions asked',
  recording: 'Recording',
  rows: 'Stats rows',
} as const;
export type SessionRow = keyof typeof SESSION_ROWS;

export type ConnectionTone = 'idle' | 'live' | 'paused';

export interface ViewState {
  room: string;
  identity: string;
  connection: { text: string; tone: ConnectionTone };
  inRoom: boolean;
  joining: boolean;
  autoStartChips: readonly string[];
  phone: {
    name: string;
    video: boolean;
    audio: boolean;
    quality: string;
    levelDb: number;
    pause: { title: string; meta: string } | undefined;
  };
  statsLine: string | undefined;
  prompter: {
    label: string;
    text: string;
    state: string;
    quiet: string;
    progress: number;
    askLabel: string;
    canAsk: boolean;
    canPrevious: boolean;
    canNext: boolean;
    voice: string;
  };
  questions: { list: readonly string[]; current: number; asked: ReadonlySet<number> };
  mode: FlowMode;
  reading: {
    label: string;
    text: string;
    clock: string;
    state: string;
    progress: number;
    startLabel: string;
    canStart: boolean;
    voice: string;
    paragraphs: readonly string[];
    current: number;
  };
  recording: { clock: string | undefined; label: string; enabled: boolean };
  session: Record<SessionRow, string>;
  canDownloadCsv: boolean;
}

export interface PageSnapshot {
  names: RoomNames;
  guest: boolean;
  joining: boolean;
  session:
    | { reconnecting: boolean; quality: string; pauseReason: string; phoneName: string | undefined }
    | undefined;
  settings: Settings;
  phone: {
    video: unknown;
    audio: unknown;
    level: number;
    joinedAt: number | undefined;
    pauses: PauseClock;
  };
  run: QuestionRun;
  quiet: QuietTimer;
  reading: { run: ReadingRun; running: boolean };
  asker: { speaking: boolean; progress: { atSec: number; lengthSec: number } };
  recorder: { startedAt: number | undefined };
  stats: { latest: PhoneStats; rowCount: number };
}

// The phone and the recording run on Date.now(), the quiet count on performance.now().
export interface Clocks {
  wallMs: number;
  monotonicMs: number;
}

const clockSince = (at: number, now: number) => formatClock((now - at) / MS_PER_SECOND);

// The phone's own name once it is in the room, the phone setting before that.
const phoneName = ({ session, names }: PageSnapshot): string => session?.phoneName ?? names.phone;

function connection(page: PageSnapshot): ViewState['connection'] {
  const { joining, session, phone } = page;
  const name = phoneName(page);
  if (joining) return { text: 'Joining…', tone: 'idle' };
  if (!session) return { text: 'Not in the room', tone: 'idle' };
  if (session.reconnecting) return { text: 'Reconnecting', tone: 'paused' };
  if (phone.pauses.paused) return { text: `${name} paused`, tone: 'paused' };
  if (!phone.video) return { text: `Connected · waiting for ${name}`, tone: 'live' };
  return { text: `Live with ${name}`, tone: 'live' };
}

function autoStartChips({ guest, settings }: PageSnapshot): string[] {
  if (guest) return [];
  const chips = [];
  if (settings.startOnJoin)
    chips.push(settings.mode === 'reading' ? 'Reading starts on join' : 'Questions start on join');
  if (settings.recordOnJoin) chips.push('Auto record on join');
  return chips;
}

function questionState({ asker, phone, run }: PageSnapshot): string {
  if (asker.speaking) {
    const { atSec, lengthSec } = asker.progress;
    return `Asking · ${formatClock(atSec)} of ${formatClock(lengthSec)}`;
  }
  if (phone.pauses.paused && run.asked.size > 0) return 'Waits for the phone to resume';
  return run.isAsked ? 'Asked' : '';
}

function prompter(page: PageSnapshot, now: Clocks): ViewState['prompter'] {
  const { run, quiet, asker, session } = page;
  const { asker: askerMode, voice, quietSec, loop } = page.settings;
  const quietFor = Math.floor(quiet.quietSec(now.monotonicMs));
  return {
    label: `QUESTION ${run.current + 1} OF ${run.questions.length}`,
    text: run.text,
    state: questionState(page),
    quiet: quiet.armed ? `Next one after ${quietSec} s of quiet · ${quietFor} s` : '',
    progress: run.asked.size / run.questions.length,
    askLabel: asker.speaking ? 'Stop' : run.isAsked ? 'Ask again' : 'Ask',
    canAsk: session !== undefined,
    canPrevious: !run.isFirst,
    canNext: run.hasNext(loop),
    voice: askerMode === 'voice' ? `${voice}, scripted` : 'Your microphone',
  };
}

function readingState({ reading, phone }: PageSnapshot): string {
  if (!reading.running) return '';
  if (phone.pauses.paused) return 'Waits for the phone to resume';
  return phone.video && phone.audio ? '' : 'Waits for the phone';
}

function reading(page: PageSnapshot, now: Clocks): ViewState['reading'] {
  const { run, running } = page.reading;
  const { phone } = page;
  const phoneRecords = Boolean(phone.video && phone.audio) && !phone.pauses.paused;
  const limitMs = readingLimitMs(page.settings.readingMinutes);
  const elapsedMs = run.elapsedMs(now.monotonicMs);
  const minutes = (ms: number) => formatMinutes(ms / MS_PER_SECOND);
  return {
    label: `Paragraph ${run.current + 1} of ${run.paragraphs.length}`,
    text: run.text,
    clock: `${minutes(elapsedMs)} of ${minutes(limitMs)}`,
    state: readingState(page),
    progress: Math.min(1, elapsedMs / limitMs),
    startLabel: running ? 'Stop' : 'Start',
    canStart: running || phoneRecords,
    voice: `${page.settings.voice}, reading`,
    paragraphs: run.paragraphs,
    current: run.current,
  };
}

function recording(page: PageSnapshot, now: Clocks): ViewState['recording'] {
  const { startedAt } = page.recorder;
  if (startedAt !== undefined) {
    const clock = clockSince(startedAt, now.wallMs);
    return { clock, label: `Stop and download · ${clock}`, enabled: true };
  }
  const canStart = Boolean(page.phone.video && page.phone.audio);
  const waits = !canStart && page.settings.recordOnJoin && !page.guest;
  return {
    clock: undefined,
    label: waits ? 'Recording starts when the phone joins' : 'Start recording',
    enabled: canStart,
  };
}

function sessionRows(page: PageSnapshot, quality: string, now: Clocks): Record<SessionRow, string> {
  const { phone, run, stats, recorder } = page;
  const { latest } = stats;
  const { joinedAt, pauses } = phone;
  return {
    phone:
      phone.video || pauses.paused ? `${phoneName(page)}, ${qualityOf(quality).label}` : 'not here',
    inRoom: joinedAt === undefined ? '-' : clockSince(joinedAt, now.wallMs),
    picture: `${orDash(latest.frameWidth)}×${orDash(latest.frameHeight)} · ${orDash(latest.framesPerSecond)} fps`,
    freezes: `${orDash(latest.freezeCount)} · ${(latest.totalFreezesDuration ?? 0).toFixed(1)} s`,
    lost: `${orDash(latest.videoPacketsLost)} / ${orDash(latest.audioPacketsLost)}`,
    pauses: `${pauses.count} · ${formatClock(pauses.totalMs(now.wallMs) / MS_PER_SECOND)}`,
    asked: `${run.asked.size} of ${run.questions.length}`,
    recording:
      recorder.startedAt === undefined ? 'off' : clockSince(recorder.startedAt, now.wallMs),
    rows: String(stats.rowCount),
  };
}

export function buildViewState(page: PageSnapshot, now: Clocks): ViewState {
  const { names, session, phone, run, stats, settings } = page;
  const quality = session?.quality ?? 'unknown';
  const { pausedAt } = phone.pauses;
  return {
    room: names.room,
    identity: names.identity,
    connection: connection(page),
    inRoom: session !== undefined,
    joining: page.joining,
    autoStartChips: autoStartChips(page),
    phone: {
      name: phoneName(page),
      video: Boolean(phone.video),
      audio: Boolean(phone.audio),
      quality,
      levelDb: levelDb(phone.level),
      pause:
        pausedAt === undefined
          ? undefined
          : {
              title: pauseTitle(session?.pauseReason ?? ''),
              meta: `paused for ${clockSince(pausedAt, now.wallMs)}`,
            },
    },
    statsLine: settings.statsOverlay ? statsLine(stats.latest) : undefined,
    prompter: prompter(page, now),
    questions: { list: run.questions, current: run.current, asked: run.asked },
    mode: settings.mode,
    reading: reading(page, now),
    recording: recording(page, now),
    session: sessionRows(page, quality, now),
    canDownloadCsv: stats.rowCount > 0,
  };
}
