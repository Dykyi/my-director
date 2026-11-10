import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PauseClock } from './pause-clock.ts';

describe('PauseClock', () => {
  it('counts a pause once and adds its length when it ends', () => {
    const clock = new PauseClock();
    assert.equal(clock.pause(1_000), true);
    assert.equal(clock.pause(2_000), false);
    assert.equal(clock.count, 1);
    assert.equal(clock.pausedAt, 1_000);
    assert.equal(clock.totalMs(4_000), 3_000);
    assert.equal(clock.resume(6_000), true);
    assert.equal(clock.paused, false);
    assert.equal(clock.totalMs(9_000), 5_000);
  });

  it('ignores a resume without a pause', () => {
    const clock = new PauseClock();
    assert.equal(clock.resume(1_000), false);
    assert.equal(clock.totalMs(1_000), 0);
  });

  it('keeps the count and the total over several pauses', () => {
    const clock = new PauseClock();
    clock.pause(0);
    clock.resume(2_000);
    clock.pause(10_000);
    clock.resume(11_000);
    assert.equal(clock.count, 2);
    assert.equal(clock.totalMs(20_000), 3_000);
  });
});
