import { describe, expect, it } from '@jest/globals';

import type { CallStatus } from '@modules/capture-core';

import { noCall, participant } from '@/src/test/call-fixtures';

import { describeCall } from './session-labels';

const call = (overrides: Partial<CallStatus>): CallStatus => ({ ...noCall, ...overrides });

describe('describeCall', () => {
  it('is quiet before a session', () =>
    expect(describeCall(call({}), false)).toEqual({ text: 'Call: not connected', tone: 'muted' }));

  it('names who is in the call', () =>
    expect(describeCall(call({ state: 'connected', quality: 'excellent', participants: [participant('interviewer')] }), true)).toEqual({
      text: 'Call: connected · excellent · standard · with interviewer',
      tone: 'secondary',
    }));

  it('says when nobody joined yet', () =>
    expect(describeCall(call({ state: 'connected', quality: 'good' }), true).text).toBe(
      'Call: connected · good · standard · waiting for the interviewer',
    ));

  it('warns while reconnecting', () =>
    expect(describeCall(call({ state: 'reconnecting' }), true)).toEqual({ text: 'Call: reconnecting…', tone: 'warning' }));

  it('warns when the call is lost during a session', () =>
    expect(describeCall(call({}), true)).toEqual({ text: 'Call: lost, the recording goes on', tone: 'warning' }));
});
