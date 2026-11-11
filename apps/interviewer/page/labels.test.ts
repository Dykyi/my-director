import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  firstWords,
  formatClock,
  formatMinutes,
  formatTimeOfDay,
  pauseTitle,
  qualityOf,
  statsLine,
} from './labels.ts';

describe('labels', () => {
  it('says why the phone paused, and just that it paused for an unknown reason', () => {
    assert.equal(pauseTitle('phoneCall'), 'The phone paused for a phone call');
    assert.equal(pauseTitle(''), 'The phone paused');
  });

  it('writes the stats line with dashes for what is not known yet', () => {
    assert.equal(
      statsLine({
        frameWidth: 1280,
        frameHeight: 720,
        framesPerSecond: 30,
        freezeCount: 0,
        bitrate: 1_200_000,
      }),
      '1280×720 · 30 fps · 0 freezes · 1.2 Mbps',
    );
    assert.equal(statsLine({}), '-×- · - fps · - freezes · - Mbps');
  });

  it('shows quality as bars and calls an unknown one measuring', () => {
    assert.deepEqual(qualityOf('good'), { bars: 2, label: 'good' });
    assert.deepEqual(qualityOf('unknown'), { bars: 0, label: 'measuring' });
  });

  it('formats clocks', () => assert.equal(formatClock(252.9), '4:12'));

  it('formats the reading time with two-digit minutes', () => {
    assert.equal(formatMinutes(192.5), '03:12');
    assert.equal(formatMinutes(600), '10:00');
  });

  it('logs the first six words of a long line', () => {
    assert.equal(firstWords('I opened the shop in a garage.'), 'I opened the shop in a…');
    assert.equal(firstWords('Why bikes?'), 'Why bikes?');
  });

  it('shows the local time of day with tenths of a second', () => {
    assert.equal(formatTimeOfDay(new Date(2026, 10, 11, 14, 52, 7, 345).getTime()), '14:52:07.3');
    assert.equal(formatTimeOfDay(new Date(2026, 10, 11, 9, 5, 3, 999).getTime()), '09:05:03.9');
  });
});
