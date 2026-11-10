import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatClock, levelDb, pauseTitle, qualityOf, statsLine } from './labels.ts';

describe('labels', () => {
  it('says why the phone paused, and just that it paused for an unknown reason', () => {
    assert.equal(pauseTitle('phoneCall'), 'The phone paused for a phone call');
    assert.equal(pauseTitle(''), 'The phone paused');
  });

  it('writes the stats line with dashes for what is not known yet', () => {
    assert.equal(
      statsLine({ width: 1280, height: 720, fps: 30, freezes: 0, bitrate: 1_200_000 }),
      '1280×720 · 30 fps · 0 freezes · 1.2 Mbps',
    );
    assert.equal(statsLine({}), '-×- · - fps · - freezes · - Mbps');
  });

  it('shows quality as bars and calls an unknown one measuring', () => {
    assert.deepEqual(qualityOf('good'), { bars: 2, label: 'good' });
    assert.deepEqual(qualityOf('unknown'), { bars: 0, label: 'measuring' });
  });

  it('formats clocks and levels', () => {
    assert.equal(formatClock(252.9), '4:12');
    assert.equal(levelDb(0.089), -21);
    assert.equal(levelDb(0), -90);
  });
});
