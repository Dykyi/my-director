import { levelDb } from './audio-level.ts';
import type { DemoFlow } from './demo-flow.ts';
import type { DemoLine, DemoSpeaker } from './demo-script.ts';
import {
  formatClock,
  formatMinutes,
  formatTimeOfDay,
  orDash,
  pauseTitle,
  qualityOf,
  statsLine,
} from './labels.ts';
import type { PauseClock } from './pause-clock.ts';
import type { QuestionRun } from './question-run.ts';
import type { QuietTimer } from './quiet-timer.ts';
import type { ReadingRun } from './reading-run.ts';
import type { RoomNames } from './room-session.ts';
import type { FlowMode, Settings } from './settings-store.ts';
import type { PhoneStats } from './stats-collector.ts';
import { talkLimitMs } from './talk-clock.ts';

const MS_PER_SECOND = 1000;
const STATUS_SEPARATOR = ' · ';

const AUTO_START_CHIP: Record<FlowMode, string> = {
  questions: 'Questions start on join',
  reading: 'Reading starts on join',
  demo: 'Demo starts on join',
};

const SPEAKER_NAME: Record<DemoSpeaker, string> = { interviewer: 'Interviewer', guest: 'Guest' };
const SCENE_SPEAKER: Record<DemoSpeaker, string> = { interviewer: 'INTERVIEWER', guest: 'GUEST' };
const SILENT = { speaker: '', text: '' };

const SCENE_HINT = {
  interviewer:
    'The interviewer speaks in the call · the phone plays it and mixes it into the recording',
  guest: "The guest speaks from this Mac · the phone's microphone records it",
  gap: 'Next line in a moment',
  paused: 'The phone is paused · nothing is recorded until it resumes',
  waiting: 'Waiting for the phone to join the call',
  finished: 'Demo finished · stop the recording on the phone',
};

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
  demo: {
    label: string;
    speaker: string;
    text: string;
    clock: string;
    state: string;
    progress: number;
    startLabel: string;
    canStart: boolean;
    voices: string;
    lines: readonly DemoLine[];
    current: number;
  };
  /** In Demo the phone listens to this Mac, so nothing of the call plays on its speakers. */
  hearLocked: boolean;
  /** What the phone's camera films: the time, and the line only while a voice says it. */
  scene: {
    clock: string;
    speaker: string;
    text: string;
    hint: string;
    status: string;
    scale: number;
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
  demo: Pick<
    DemoFlow,
    'lines' | 'current' | 'line' | 'running' | 'finished' | 'sounding' | 'elapsedMs'
  >;
  asker: { speaking: boolean; sounding: boolean; progress: { atSec: number; lengthSec: number } };
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
  if (settings.startOnJoin) chips.push(AUTO_START_CHIP[settings.mode]);
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

type TalkView = Pick<
  ViewState['reading'],
  'clock' | 'state' | 'progress' | 'startLabel' | 'canStart'
>;

function talk(page: PageSnapshot, running: boolean, elapsedMs: number): TalkView {
  const { phone } = page;
  const phoneRecords = Boolean(phone.video && phone.audio) && !phone.pauses.paused;
  const limitMs = talkLimitMs(page.settings.talkMinutes);
  const minutes = (ms: number) => formatMinutes(ms / MS_PER_SECOND);
  const waits = phone.pauses.paused ? 'Waits for the phone to resume' : 'Waits for the phone';
  return {
    clock: `${minutes(elapsedMs)} of ${minutes(limitMs)}`,
    state: running && !phoneRecords ? waits : '',
    progress: Math.min(1, elapsedMs / limitMs),
    startLabel: running ? 'Stop' : 'Start',
    canStart: running || phoneRecords,
  };
}

function reading(page: PageSnapshot, now: Clocks): ViewState['reading'] {
  const { run, running } = page.reading;
  return {
    label: `Paragraph ${run.current + 1} of ${run.paragraphs.length}`,
    text: run.text,
    ...talk(page, running, run.elapsedMs(now.monotonicMs)),
    voice: `${page.settings.voice}, reading`,
    paragraphs: run.paragraphs,
    current: run.current,
  };
}

function demo(page: PageSnapshot, now: Clocks): ViewState['demo'] {
  const { lines, current, line, running } = page.demo;
  const { voice, guestVoice } = page.settings;
  return {
    label: `Line ${current + 1} of ${lines.length}`,
    speaker: SPEAKER_NAME[line.speaker],
    text: line.text,
    ...talk(page, running, page.demo.elapsedMs(now.monotonicMs)),
    voices: `${voice} asks · ${guestVoice} answers on this Mac`,
    lines,
    current,
  };
}

function sceneLine({ settings, demo, asker, reading, run }: PageSnapshot) {
  if (settings.mode === 'demo') {
    if (!demo.sounding) return SILENT;
    return { speaker: SCENE_SPEAKER[demo.line.speaker], text: demo.line.text };
  }
  if (!asker.sounding) return SILENT;
  const text = settings.mode === 'reading' ? reading.run.text : run.text;
  return { speaker: SCENE_SPEAKER.interviewer, text };
}

// Tells a viewer of the phone's video what goes on; the phone's own state comes before the voices.
function sceneHint({ session, phone, settings, demo, asker }: PageSnapshot): string {
  if (phone.pauses.paused) return SCENE_HINT.paused;
  if (!session || !phone.video) return SCENE_HINT.waiting;
  if (settings.mode !== 'demo') return asker.sounding ? SCENE_HINT.interviewer : '';
  if (demo.sounding) return SCENE_HINT[demo.line.speaker];
  if (demo.running) return SCENE_HINT.gap;
  return demo.finished ? SCENE_HINT.finished : '';
}

function sceneStatus({ run }: PageSnapshot, state: Omit<ViewState, 'scene'>): string {
  const { mode, demo, reading } = state;
  const live = state.phone.pause?.title ?? state.connection.text;
  if (mode === 'demo') return [demo.label, live, demo.clock].join(STATUS_SEPARATOR);
  if (mode === 'reading') return [reading.label, live, reading.clock].join(STATUS_SEPARATOR);
  return [`Question ${run.current + 1} of ${run.questions.length}`, live].join(STATUS_SEPARATOR);
}

function scene(
  page: PageSnapshot,
  state: Omit<ViewState, 'scene'>,
  now: Clocks,
): ViewState['scene'] {
  return {
    clock: formatTimeOfDay(now.wallMs),
    ...sceneLine(page),
    hint: sceneHint(page),
    status: sceneStatus(page, state),
    scale: page.settings.sceneScale,
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
  const state: Omit<ViewState, 'scene'> = {
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
    demo: demo(page, now),
    hearLocked: settings.mode === 'demo',
    recording: recording(page, now),
    session: sessionRows(page, quality, now),
    canDownloadCsv: stats.rowCount > 0,
  };
  return { ...state, scene: scene(page, state, now) };
}
