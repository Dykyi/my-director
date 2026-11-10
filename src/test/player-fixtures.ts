import type { RecordingSummary } from '@modules/capture-core';

import { recording, segment } from './session-fixtures';

const MB = 1_024 ** 2;

export const interview: RecordingSummary = recording({
  segments: [
    segment(1, { durationSec: 238, bytes: 183 * MB, pauseReason: 'phoneCall' }),
    segment(2, { durationSec: 160, bytes: 123 * MB, pauseReason: 'screenLocked' }),
    segment(3, { durationSec: 152, bytes: 116 * MB }),
  ],
  totalSec: 550,
  totalBytes: 422 * MB,
});

export const crashed: RecordingSummary = recording({
  state: 'recovered',
  segments: [
    segment(1, { durationSec: 210, bytes: 161 * MB, pauseReason: 'user' }),
    segment(2, { durationSec: 152, bytes: 119 * MB, state: 'recovered' }),
  ],
  totalSec: 362,
  totalBytes: 280 * MB,
});
