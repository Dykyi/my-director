import { describe, expect, it } from '@jest/globals';

import type { LogEntry, LogLevel, SessionPhase, SessionSnapshot } from '@modules/capture-core';

import { noCall } from '@test/call-fixtures';

import { healthLine, issueBadge, sessionIssues } from './session-issues';

const at = (sec: number) => new Date(Date.UTC(2026, 10, 10, 9, 0, sec)).toISOString();
const log = (level: LogLevel, message: string, sec: number): LogEntry => ({
  at: at(sec),
  mono: sec,
  level,
  category: 'camera',
  message,
});
const snapshot = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  phase: 'recording',
  sessionId: '2026-11-10T09-00-00Z-0001',
  startedAt: at(10),
  segmentIndex: 1,
  recordedSec: 30,
  activeInterruptions: [],
  call: noCall,
  thermal: 'nominal',
  warnings: [],
  ...overrides,
});

describe('sessionIssues', () => {
  it('takes warnings and errors logged since Start, newest first', () =>
    expect(
      sessionIssues(snapshot(), [
        log('error', 'Segment writer failed', 30),
        log('info', 'Segment 1 opened', 20),
        log('warning', 'Camera frames missing', 15),
        log('warning', 'Before Start', 5),
      ]).map((issue) => issue.text),
    ).toEqual(['Segment writer failed', 'Camera frames missing']));

  it('adds the error and the active warnings', () =>
    expect(
      sessionIssues(
        snapshot({
          error: {
            code: 'fileWriterFailed',
            message: 'Writing the file failed',
            at: at(40),
            recoverable: true,
          },
          warnings: [{ code: 'diskSpaceLow', message: '1.0 GB left', since: at(35) }],
        }),
        [],
      ),
    ).toEqual([
      { severity: 'error', text: 'Writing the file failed', at: at(40) },
      { severity: 'warning', text: '1.0 GB left', at: at(35) },
    ]));

  it('ignores the log outside a session', () =>
    expect(
      sessionIssues(snapshot({ phase: 'ready', sessionId: undefined, startedAt: undefined }), [
        log('warning', 'x', 50),
      ]),
    ).toEqual([]));
});

describe('healthLine', () => {
  it('names the newest warning with the session time', () =>
    expect(
      healthLine([{ severity: 'warning', text: 'Camera frames missing', at: at(341) }], snapshot()),
    ).toEqual({ tone: 'warning', text: 'Camera frames missing', detail: 'at 05:31' }));

  it('puts an error ahead of newer warnings', () =>
    expect(
      healthLine(
        [
          { severity: 'warning', text: 'Camera frames missing', at: at(20) },
          { severity: 'error', text: 'Segment writer failed', at: at(15) },
        ],
        snapshot(),
      ).tone,
    ).toBe('error'));

  it('says the mic is off while paused', () =>
    expect(healthLine([], snapshot({ phase: 'paused' }))).toEqual({
      tone: 'paused',
      text: 'Microphone off while paused',
    }));

  it.each<[SessionPhase, string]>([
    ['ready', 'Camera and microphone ready'],
    ['recording', 'File, camera and audio all normal'],
    ['idle', 'Camera off'],
  ])('is calm when %s', (phase, text) =>
    expect(healthLine([], snapshot({ phase }))).toEqual({ tone: 'ok', text }),
  );
});

describe('issueBadge', () => {
  it('counts the issues in the worst tone', () =>
    expect(
      issueBadge([
        { severity: 'warning', text: 'a', at: at(2) },
        { severity: 'error', text: 'b', at: at(1) },
      ]),
    ).toEqual({ count: 2, severity: 'error' }));
  it('is absent without issues', () => expect(issueBadge([])).toBeUndefined());
});
