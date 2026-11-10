import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bitsPerSecond, csvRow, phoneStats } from './stats-collector.ts';

const video = {
  type: 'inbound-rtp',
  frameWidth: 1280,
  frameHeight: 720,
  framesPerSecond: 30,
  framesDecoded: 900,
  freezeCount: 1,
  totalFreezesDuration: 0.4,
  packetsLost: 2,
  jitter: 0.01,
  bytesReceived: 1_500_000,
};
const audio = {
  type: 'inbound-rtp',
  packetsLost: 3,
  jitter: 0.02,
  bytesReceived: 48_000,
  concealedSamples: 960,
};

describe('stats collector', () => {
  it('reads the phone stats from the video and audio reports', () =>
    assert.deepEqual(phoneStats(video, audio), {
      frameWidth: 1280,
      frameHeight: 720,
      framesPerSecond: 30,
      freezeCount: 1,
      totalFreezesDuration: 0.4,
      videoPacketsLost: 2,
      audioPacketsLost: 3,
    }));

  it('turns two byte counts into bits per second', () =>
    assert.equal(bitsPerSecond({ bytes: 0, at: 0 }, { bytes: 150_000, at: 1_000 }), 1_200_000));

  it('writes one CSV row per second in the column order', () => {
    const at = '2026-11-10T21:00:00.000Z';
    assert.equal(
      csvRow({ at, paused: false, level: 0.012345, video, audio }),
      `${at},0,1280,720,30,900,1,0.4,2,0.01,1500000,3,0.02,0.0123,960,48000`,
    );
    assert.equal(csvRow({ at, paused: true, level: 0 }), `${at},1,,,,,,,,,,,,0.0000,,`);
  });
});
