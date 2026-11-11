import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DemoLine } from './demo-script.ts';
import { formatTimeOfDay } from './labels.ts';
import { PauseClock } from './pause-clock.ts';
import { QuestionRun } from './question-run.ts';
import { QuietTimer } from './quiet-timer.ts';
import { ReadingRun } from './reading-run.ts';
import { DEFAULT_SETTINGS } from './settings-store.ts';
import { buildViewState, type PageSnapshot } from './view-state.ts';

const now = { wallMs: 1_000_000, monotonicMs: 50_000 };
const HINT = {
  interviewer:
    'The interviewer speaks in the call · the phone plays it and mixes it into the recording',
  guest: "The guest speaks from this Mac · the phone's microphone records it",
  gap: 'Next line in a moment',
  paused: 'The phone is paused · nothing is recorded until it resumes',
  waiting: 'Waiting for the phone to join the call',
  finished: 'Demo finished · stop the recording on the phone',
};
const QUESTIONS = Array.from({ length: 10 }, (_, index) => `Question ${index + 1}?`);
const PARAGRAPHS = Array.from({ length: 22 }, (_, index) => `Paragraph ${index + 1}.`);
const LINES: DemoLine[] = Array.from({ length: 32 }, (_, index) => ({
  speaker: index % 2 === 0 ? 'interviewer' : 'guest',
  text: `Line ${index + 1}.`,
}));
const reading = { ...DEFAULT_SETTINGS, mode: 'reading' as const };
const demoMode = { ...DEFAULT_SETTINGS, mode: 'demo' as const };
const session = {
  reconnecting: false,
  quality: 'excellent',
  pauseReason: '',
  phoneName: undefined,
};

function demoAt(current: number, overrides: Partial<PageSnapshot['demo']> = {}) {
  return {
    lines: LINES,
    current,
    line: LINES[current] ?? { speaker: 'interviewer' as const, text: '' },
    running: false,
    finished: false,
    sounding: false,
    elapsedMs: () => 0,
    ...overrides,
  };
}

function snapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    names: { room: 'mydirector-poc', identity: 'interviewer', phone: 'iphone' },
    guest: false,
    joining: false,
    session: undefined,
    settings: DEFAULT_SETTINGS,
    phone: {
      video: undefined,
      audio: undefined,
      level: 0,
      joinedAt: undefined,
      pauses: new PauseClock(),
    },
    run: new QuestionRun(QUESTIONS),
    quiet: new QuietTimer(),
    reading: { run: new ReadingRun(PARAGRAPHS), running: false },
    demo: demoAt(0),
    asker: { speaking: false, sounding: false, progress: { atSec: 0, lengthSec: 0 } },
    recorder: { startedAt: undefined },
    stats: { latest: {}, rowCount: 0 },
    ...overrides,
  };
}

const livePhone = (pauses = new PauseClock()) => ({
  video: {},
  audio: {},
  level: 0.089,
  joinedAt: now.wallMs - 30_000,
  pauses,
});

describe('buildViewState', () => {
  it('describes the page before Join', () => {
    const state = buildViewState(snapshot(), now);
    assert.deepEqual(state.connection, { text: 'Not in the room', tone: 'idle' });
    assert.equal(state.inRoom, false);
    assert.deepEqual(state.autoStartChips, ['Questions start on join', 'Auto record on join']);
    assert.deepEqual(state.recording, {
      clock: undefined,
      label: 'Recording starts when the phone joins',
      enabled: false,
    });
    assert.equal(state.statsLine, '-×- · - fps · - freezes · - Mbps');
    assert.equal(state.phone.levelDb, -90);
    assert.equal(state.phone.pause, undefined);
    assert.equal(state.canDownloadCsv, false);
    assert.deepEqual(state.prompter, {
      label: 'QUESTION 1 OF 10',
      text: 'Question 1?',
      state: '',
      quiet: '',
      progress: 0,
      askLabel: 'Ask',
      canAsk: false,
      canPrevious: false,
      canNext: true,
      voice: 'Samantha, scripted',
    });
    assert.deepEqual(state.session, {
      phone: 'not here',
      inRoom: '-',
      picture: '-×- · - fps',
      freezes: '- · 0.0 s',
      lost: '- / -',
      pauses: '0 · 0:00',
      asked: '0 of 10',
      recording: 'off',
      rows: '0',
    });
  });

  it('says how the connection goes', () => {
    const connection = (overrides: Partial<PageSnapshot>) =>
      buildViewState(snapshot(overrides), now).connection;
    assert.deepEqual(connection({ joining: true }), { text: 'Joining…', tone: 'idle' });
    assert.deepEqual(connection({ session }), {
      text: 'Connected · waiting for iphone',
      tone: 'live',
    });
    assert.deepEqual(connection({ session: { ...session, reconnecting: true } }), {
      text: 'Reconnecting',
      tone: 'paused',
    });
    assert.deepEqual(connection({ session, phone: livePhone() }), {
      text: 'Live with iphone',
      tone: 'live',
    });
  });

  it('names the phone as it calls itself in the room', () => {
    const named = { ...session, phoneName: 'Studio phone' };
    const state = buildViewState(snapshot({ session: named, phone: livePhone() }), now);
    assert.equal(state.phone.name, 'Studio phone');
    assert.deepEqual(state.connection, { text: 'Live with Studio phone', tone: 'live' });
    assert.equal(state.session.phone, 'Studio phone, excellent');
    const waiting = buildViewState(snapshot({ session }), now);
    assert.equal(waiting.phone.name, 'iphone');
  });

  it('lets a guest only watch', () => {
    const state = buildViewState(snapshot({ guest: true }), now);
    assert.deepEqual(state.autoStartChips, []);
    assert.equal(state.recording.label, 'Start recording');
  });

  it('shows the recording clock while the call is recorded', () => {
    const recorder = { startedAt: now.wallMs - 65_000 };
    const state = buildViewState(snapshot({ session, phone: livePhone(), recorder }), now);
    assert.deepEqual(state.recording, {
      clock: '1:05',
      label: 'Stop and download · 1:05',
      enabled: true,
    });
    assert.equal(state.session.recording, '1:05');
    assert.equal(state.session.phone, 'iphone, excellent');
    assert.equal(state.session.inRoom, '0:30');
    assert.equal(state.phone.levelDb, -21);
  });

  it('follows the question as it is read, asked and waited on', () => {
    const run = new QuestionRun(QUESTIONS);
    const speaking = { speaking: true, sounding: true, progress: { atSec: 2.4, lengthSec: 6.1 } };
    const reading = buildViewState(
      snapshot({ session, phone: livePhone(), run, asker: speaking }),
      now,
    );
    assert.equal(reading.prompter.askLabel, 'Stop');
    assert.equal(reading.prompter.state, 'Asking · 0:02 of 0:06');

    run.markAsked();
    const quiet = new QuietTimer();
    quiet.arm(now.monotonicMs - 3_000);
    const asked = buildViewState(snapshot({ session, phone: livePhone(), run, quiet }), now);
    assert.equal(asked.prompter.askLabel, 'Ask again');
    assert.equal(asked.prompter.state, 'Asked');
    assert.equal(asked.prompter.quiet, 'Next one after 20 s of quiet · 3 s');
    assert.equal(asked.prompter.progress, 0.1);
    assert.equal(asked.session.asked, '1 of 10');
  });

  it('shows the pause, its reason and the total paused time', () => {
    const pauses = new PauseClock();
    pauses.pause(now.wallMs - 5_000);
    const run = new QuestionRun(QUESTIONS);
    run.markAsked();
    const state = buildViewState(
      snapshot({ session: { ...session, pauseReason: 'user' }, phone: livePhone(pauses), run }),
      now,
    );
    assert.deepEqual(state.phone.pause, {
      title: 'The phone paused: Pause was pressed on it',
      meta: 'paused for 0:05',
    });
    assert.deepEqual(state.connection, { text: 'iphone paused', tone: 'paused' });
    assert.equal(state.prompter.state, 'Waits for the phone to resume');
    assert.equal(state.session.pauses, '1 · 0:05');
  });

  it('shows a phone that rejoined on pause without a picture as paused', () => {
    const pauses = new PauseClock();
    pauses.pause(now.wallMs - 5_000);
    const phone = { ...snapshot().phone, pauses };
    const state = buildViewState(
      snapshot({ session: { ...session, pauseReason: 'user' }, phone }),
      now,
    );
    assert.deepEqual(state.connection, { text: 'iphone paused', tone: 'paused' });
    assert.equal(state.phone.pause?.title, 'The phone paused: Pause was pressed on it');
    assert.equal(state.session.phone, 'iphone, excellent');
  });

  it('shows where the reading is and how long it has read', () => {
    const run = new ReadingRun(PARAGRAPHS);
    for (let step = 0; step < 6; step += 1) run.advance();
    run.resume(now.monotonicMs - 192_000);
    const state = buildViewState(
      snapshot({
        settings: reading,
        session,
        phone: livePhone(),
        reading: { run, running: true },
      }),
      now,
    );
    assert.equal(state.mode, 'reading');
    assert.deepEqual(state.reading, {
      label: 'Paragraph 7 of 22',
      text: 'Paragraph 7.',
      clock: '03:12 of 10:00',
      state: '',
      progress: 0.32,
      startLabel: 'Stop',
      canStart: true,
      voice: 'Samantha, reading',
      paragraphs: PARAGRAPHS,
      current: 6,
    });
  });

  it('offers Start only while the phone records and Stop while it reads', () => {
    const view = (overrides: Partial<PageSnapshot>, running: boolean) =>
      buildViewState(
        snapshot({
          settings: reading,
          reading: { run: new ReadingRun(PARAGRAPHS), running },
          ...overrides,
        }),
        now,
      ).reading;
    const pauses = new PauseClock();
    pauses.pause(now.wallMs - 5_000);

    const before = view({}, false);
    assert.equal(before.startLabel, 'Start');
    assert.equal(before.canStart, false);
    assert.equal(before.clock, '00:00 of 10:00');
    assert.equal(view({ session }, false).canStart, false);
    assert.equal(view({ session, phone: livePhone() }, false).canStart, true);
    assert.equal(view({ session, phone: livePhone(pauses) }, false).canStart, false);

    const paused = view({ session, phone: livePhone(pauses) }, true);
    assert.deepEqual([paused.startLabel, paused.canStart], ['Stop', true]);
    assert.equal(paused.state, 'Waits for the phone to resume');
    assert.equal(view({ session }, true).state, 'Waits for the phone');
  });

  it('says the reading starts on join', () =>
    assert.deepEqual(buildViewState(snapshot({ settings: reading }), now).autoStartChips, [
      'Reading starts on join',
      'Auto record on join',
    ]));

  it('follows the settings for the asker and the stats line', () => {
    const settings = { ...DEFAULT_SETTINGS, asker: 'microphone' as const, statsOverlay: false };
    const state = buildViewState(snapshot({ settings }), now);
    assert.equal(state.prompter.voice, 'Your microphone');
    assert.equal(state.statsLine, undefined);
  });

  it('shows where the demo is, who speaks and how long it has run', () => {
    const elapsedMs = (at: number) => at - (now.monotonicMs - 134_000);
    const state = buildViewState(
      snapshot({
        settings: demoMode,
        session,
        phone: livePhone(),
        demo: demoAt(2, { running: true, elapsedMs }),
      }),
      now,
    );
    assert.equal(state.mode, 'demo');
    assert.deepEqual(state.demo, {
      label: 'Line 3 of 32',
      speaker: 'Interviewer',
      text: 'Line 3.',
      clock: '02:14 of 10:00',
      state: '',
      progress: 134 / 600,
      startLabel: 'Stop',
      canStart: true,
      voices: 'Samantha asks · Daniel answers on this Mac',
      lines: LINES,
      current: 2,
    });
    assert.deepEqual(buildViewState(snapshot({ settings: demoMode }), now).autoStartChips, [
      'Demo starts on join',
      'Auto record on join',
    ]);
  });

  it('turns the Hear switches off only in Demo', () => {
    assert.equal(buildViewState(snapshot({ settings: demoMode }), now).hearLocked, true);
    assert.equal(buildViewState(snapshot({ settings: reading }), now).hearLocked, false);
    assert.equal(buildViewState(snapshot(), now).hearLocked, false);
  });

  it('shows the subtitle on the scene only while a voice is saying it', () => {
    const scene = (sounding: boolean) =>
      buildViewState(
        snapshot({
          settings: demoMode,
          session,
          phone: livePhone(),
          demo: demoAt(3, { running: true, sounding }),
        }),
        now,
      ).scene;
    assert.deepEqual(scene(false), {
      clock: formatTimeOfDay(now.wallMs),
      speaker: '',
      text: '',
      hint: HINT.gap,
      status: 'Line 4 of 32 · Live with iphone · 00:00 of 10:00',
      scale: 0.8,
    });
    assert.deepEqual(scene(true), {
      clock: formatTimeOfDay(now.wallMs),
      speaker: 'GUEST',
      text: 'Line 4.',
      hint: HINT.guest,
      status: 'Line 4 of 32 · Live with iphone · 00:00 of 10:00',
      scale: 0.8,
    });
  });

  it('tells the viewer of the video what happens in Demo', () => {
    const hint = (demo: PageSnapshot['demo']) =>
      buildViewState(snapshot({ settings: demoMode, session, phone: livePhone(), demo }), now).scene
        .hint;
    assert.equal(hint(demoAt(0, { running: true, sounding: true })), HINT.interviewer);
    assert.equal(hint(demoAt(1, { running: true, sounding: true })), HINT.guest);
    assert.equal(hint(demoAt(1, { running: true })), HINT.gap);
    assert.equal(hint(demoAt(1, { finished: true })), HINT.finished);
    assert.equal(hint(demoAt(1)), '');
  });

  it('puts the pause and the wait for the phone before the voice on the scene', () => {
    const pauses = new PauseClock();
    pauses.pause(now.wallMs - 5_000);
    const demo = demoAt(1, { running: true, sounding: true });
    const hint = (overrides: Partial<PageSnapshot>) =>
      buildViewState(snapshot({ settings: demoMode, demo, ...overrides }), now).scene.hint;
    assert.equal(hint({ session, phone: livePhone(pauses) }), HINT.paused);
    assert.equal(hint({}), HINT.waiting);
    assert.equal(hint({ session }), HINT.waiting);
  });

  it('only says that the interviewer speaks in Questions and Reading', () => {
    const asker = { speaking: true, sounding: true, progress: { atSec: 0, lengthSec: 0 } };
    const hint = (overrides: Partial<PageSnapshot>) =>
      buildViewState(snapshot({ session, phone: livePhone(), ...overrides }), now).scene.hint;
    assert.equal(hint({ asker }), HINT.interviewer);
    assert.equal(hint({ settings: reading, asker }), HINT.interviewer);
    assert.equal(
      hint({ settings: reading, reading: { run: new ReadingRun(PARAGRAPHS), running: true } }),
      '',
    );
    assert.equal(hint({}), '');
    assert.equal(hint({ session: undefined, asker }), HINT.waiting);
  });

  it('shrinks the scene by the saved scale', () =>
    assert.equal(
      buildViewState(snapshot({ settings: { ...DEFAULT_SETTINGS, sceneScale: 0.6 } }), now).scene
        .scale,
      0.6,
    ));

  it('keeps the question off the scene while its speech is still on the way', () => {
    const fetching = { speaking: true, sounding: false, progress: { atSec: 0, lengthSec: 0 } };
    const state = buildViewState(snapshot({ session, phone: livePhone(), asker: fetching }), now);
    assert.deepEqual([state.scene.speaker, state.scene.text], ['', '']);
    assert.equal(state.prompter.askLabel, 'Stop');
  });

  it('says why the phone paused on the scene', () => {
    const pauses = new PauseClock();
    pauses.pause(now.wallMs - 5_000);
    const state = buildViewState(
      snapshot({
        settings: demoMode,
        session: { ...session, pauseReason: 'phoneCall' },
        phone: livePhone(pauses),
        demo: demoAt(0, { running: true }),
      }),
      now,
    );
    assert.equal(
      state.scene.status,
      'Line 1 of 32 · The phone paused for a phone call · 00:00 of 10:00',
    );
  });

  it('shows the asked question and the read paragraph on the scene as the interviewer', () => {
    const speaking = { speaking: true, sounding: true, progress: { atSec: 0, lengthSec: 0 } };
    const asking = buildViewState(
      snapshot({ session, phone: livePhone(), asker: speaking }),
      now,
    ).scene;
    assert.deepEqual(
      [asking.speaker, asking.text, asking.status],
      ['INTERVIEWER', 'Question 1?', 'Question 1 of 10 · Live with iphone'],
    );
    const run = new ReadingRun(PARAGRAPHS);
    run.advance();
    const readingScene = buildViewState(
      snapshot({
        settings: reading,
        session,
        phone: livePhone(),
        reading: { run, running: true },
        asker: speaking,
      }),
      now,
    ).scene;
    assert.deepEqual(
      [readingScene.speaker, readingScene.text, readingScene.status],
      ['INTERVIEWER', 'Paragraph 2.', 'Paragraph 2 of 22 · Live with iphone · 00:00 of 10:00'],
    );
  });
});
