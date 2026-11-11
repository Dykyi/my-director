import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeFormValues, type FormValues } from './settings-form.ts';
import { DEFAULT_SETTINGS } from './settings-store.ts';

const values: FormValues = {
  room: 'studio',
  identity: 'anna',
  phone: 'iphone-2',
  asker: 'microphone',
  voice: 'Daniel',
  quietSec: '30',
  mode: 'reading',
  readingMinutes: '15',
  startOnJoin: false,
  loop: true,
  recordOnJoin: false,
  statsCsv: false,
  statsOverlay: false,
};

describe('mergeFormValues', () => {
  it('takes what the form holds and keeps the side switch', () =>
    assert.deepEqual(mergeFormValues(values, { ...DEFAULT_SETTINGS, hearPhone: true }), {
      ...values,
      quietSec: 30,
      readingMinutes: 15,
      hearPhone: true,
    }));

  it('keeps the old name when a field is left empty', () => {
    const merged = mergeFormValues({ ...values, room: '  ', identity: ' bob ' }, DEFAULT_SETTINGS);
    assert.equal(merged.room, 'mydirector-poc');
    assert.equal(merged.identity, 'bob');
  });

  it('keeps the old quiet time for an empty or broken value and snaps a big one', () => {
    const quietSec = (typed: string) =>
      mergeFormValues({ ...values, quietSec: typed }, DEFAULT_SETTINGS).quietSec;
    assert.equal(quietSec(''), 20);
    assert.equal(quietSec('abc'), 20);
    assert.equal(quietSec('999'), 120);
    assert.equal(quietSec('1'), 3);
  });

  it('keeps the old reading length for an empty value and snaps it to whole minutes', () => {
    const readingMinutes = (typed: string) =>
      mergeFormValues({ ...values, readingMinutes: typed }, DEFAULT_SETTINGS).readingMinutes;
    assert.equal(readingMinutes(''), 10);
    assert.equal(readingMinutes('abc'), 10);
    assert.equal(readingMinutes('90'), 60);
    assert.equal(readingMinutes('7.4'), 7);
  });
});
