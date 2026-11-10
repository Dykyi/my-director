import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseScript, QuestionRun } from './question-run.ts';

describe('parseScript', () => {
  it('reads one question per line', () =>
    assert.deepEqual(parseScript(' First?\n\n  Second?  \n'), ['First?', 'Second?']));
});

describe('QuestionRun', () => {
  it('moves back and forth and keeps the asked marks', () => {
    const run = new QuestionRun(['A?', 'B?', 'C?']);
    run.markAsked();
    assert.equal(run.next(false), true);
    assert.equal(run.text, 'B?');
    run.markAsked();
    run.previous();
    assert.equal(run.current, 0);
    assert.equal(run.isAsked, true);
    assert.deepEqual([...run.asked], [0, 1]);
    run.previous();
    assert.equal(run.current, 0);
  });

  it('has a next question before the last one, and after it only when it loops', () => {
    const run = new QuestionRun(['A?', 'B?']);
    assert.equal(run.hasNext(false), true);
    run.select(1);
    assert.equal(run.hasNext(false), false);
    assert.equal(run.hasNext(true), true);
  });

  it('stops after the last question unless it loops', () => {
    const run = new QuestionRun(['A?', 'B?']);
    run.select(1);
    run.markAsked();
    assert.equal(run.next(false), false);
    assert.equal(run.current, 1);
    assert.equal(run.next(true), true);
    assert.equal(run.current, 0);
    assert.equal(run.asked.size, 0);
  });
});
