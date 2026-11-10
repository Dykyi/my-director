import { describe, expect, it } from '@jest/globals';

import { describeError } from './describe-error';

const EXPO_CHAIN =
  "FunctionCallException: Calling the 'start' function has failed (at ExpoModulesCore/ConcurrentFunctionDefinition.swift:88)\n→ Caused by: CaptureException: Can't start while paused (at CaptureCore/CaptureCoreModule.swift:105)";

describe('describeError', () => {
  it('keeps only the native reason and its code', () =>
    expect(describeError(Object.assign(new Error(EXPO_CHAIN), { code: 'invalidState' }))).toBe(
      "invalidState: Can't start while paused",
    ));
  it('shows a plain error as it is', () =>
    expect(describeError(new Error('Network down'))).toBe('Network down'));
  it('shows anything else as text', () => expect(describeError('boom')).toBe('boom'));
});
