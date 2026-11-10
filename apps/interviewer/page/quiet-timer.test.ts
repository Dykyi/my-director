import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MIN_VOICE_MS, QuietTimer, VOICE_LEVEL } from './quiet-timer.ts';

describe('QuietTimer', () => {
  it('counts quiet only after a question ends', () => {
    const quiet = new QuietTimer();
    assert.equal(quiet.isDue(60_000, 20), false);
    quiet.arm(1_000);
    assert.equal(quiet.isDue(20_000, 20), false);
    assert.equal(quiet.isDue(21_000, 20), true);
  });

  it('starts over on a word and ignores the noise floor', () => {
    const quiet = new QuietTimer();
    quiet.arm(0);
    quiet.sample(VOICE_LEVEL / 50, 15_000);
    assert.equal(quiet.quietSec(15_000), 15);
    quiet.sample(VOICE_LEVEL * 4, 15_000);
    quiet.sample(VOICE_LEVEL * 4, 15_000 + MIN_VOICE_MS);
    assert.equal(quiet.isDue(35_000, 20), false);
    assert.equal(quiet.isDue(35_300, 20), true);
    quiet.disarm();
    assert.equal(quiet.isDue(99_000, 20), false);
  });

  it('lets a click or a knock pass, since it is shorter than a word', () => {
    const quiet = new QuietTimer();
    quiet.arm(0);
    quiet.sample(VOICE_LEVEL * 10, 5_000);
    quiet.sample(VOICE_LEVEL / 50, 5_100);
    quiet.sample(VOICE_LEVEL * 10, 5_200);
    assert.equal(quiet.quietSec(6_000), 6);
  });
});
