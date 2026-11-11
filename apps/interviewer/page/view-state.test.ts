import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PauseClock } from './pause-clock.ts';
import { QuestionRun } from './question-run.ts';
import { QuietTimer } from './quiet-timer.ts';
import { DEFAULT_SETTINGS } from './settings-store.ts';
import { buildViewState, type PageSnapshot } from './view-state.ts';

const now = { wallMs: 1_000_000, monotonicMs: 50_000 };
const QUESTIONS = Array.from({ length: 10 }, (_, index) => `Question ${index + 1}?`);
const session = { reconnecting: false, quality: 'excellent', pauseReason: '' };

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
    asker: { speaking: false, progress: { atSec: 0, lengthSec: 0 } },
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
    const speaking = { speaking: true, progress: { atSec: 2.4, lengthSec: 6.1 } };
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

  it('follows the settings for the asker and the stats line', () => {
    const settings = { ...DEFAULT_SETTINGS, asker: 'microphone' as const, statsOverlay: false };
    const state = buildViewState(snapshot({ settings }), now);
    assert.equal(state.prompter.voice, 'Your microphone');
    assert.equal(state.statsLine, undefined);
  });
});
