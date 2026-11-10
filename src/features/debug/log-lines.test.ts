import { describe, expect, it } from '@jest/globals';

import { logLines } from './log-lines';

describe('logLines', () => {
  it('puts each detail on its own line under the event', () =>
    expect(
      logLines({
        at: '2026-11-10T09:25:31.000Z',
        mono: 1,
        level: 'warning',
        category: 'camera',
        message: 'frames missing 233 ms',
        data: { dropped: 'FrameWasLate 7' },
      }),
    ).toEqual({
      head: '09:25:31.000 warning camera frames missing 233 ms',
      details: ['dropped FrameWasLate 7'],
    }));
});
