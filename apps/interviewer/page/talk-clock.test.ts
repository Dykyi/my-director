import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TalkClock, talkLimitMs } from './talk-clock.ts';

describe('talkLimitMs', () => {
  it('turns minutes into milliseconds', () => assert.equal(talkLimitMs(10), 600_000));
});

describe('TalkClock', () => {
  it('runs only between resume and pause', () => {
    const clock = new TalkClock();
    assert.equal(clock.elapsedMs(5_000), 0);
    clock.resume(10_000);
    clock.pause(13_000);
    assert.equal(clock.elapsedMs(50_000), 3_000);
    clock.resume(60_000);
    assert.equal(clock.elapsedMs(61_000), 4_000);
  });

  it('keeps its start on a second resume and ignores a second pause', () => {
    const clock = new TalkClock();
    clock.resume(0);
    clock.resume(2_000);
    clock.pause(4_000);
    clock.pause(5_000);
    assert.equal(clock.elapsedMs(9_000), 4_000);
  });

  it('is done at the limit', () => {
    const clock = new TalkClock();
    clock.resume(0);
    assert.equal(clock.isDone(9_999, 10_000), false);
    assert.equal(clock.isDone(10_000, 10_000), true);
  });
});
