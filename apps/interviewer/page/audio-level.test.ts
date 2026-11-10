import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { levelDb, litBars, rms } from './audio-level.ts';

describe('audio level', () => {
  it('measures the RMS of the samples', () => {
    assert.equal(rms(new Float32Array([0.5, -0.5, 0.5, -0.5])), 0.5);
    assert.equal(rms(new Float32Array(4)), 0);
  });

  it('turns the level into whole dBFS with a floor for silence', () => {
    assert.equal(levelDb(0.089), -21);
    assert.equal(levelDb(0), -90);
  });

  it('lights the meter from -60 dBFS to full scale', () => {
    assert.equal(litBars(-60, 12), 0);
    assert.equal(litBars(-30, 12), 6);
    assert.equal(litBars(0, 12), 12);
    assert.ok(litBars(-90, 12) <= 0);
  });
});
