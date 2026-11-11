import { describe, expect, it, jest } from '@jest/globals';

import { memoryKvStore as mockKvStore } from '@test/memory-kv-store';

import { installId, normalizeCallName } from './call-identity';

jest.mock('expo-sqlite/kv-store', () => mockKvStore);

describe('normalizeCallName', () => {
  it('trims the name', () => expect(normalizeCallName('  Studio phone  ')).toBe('Studio phone'));
  it('falls back to the default name', () => {
    expect(normalizeCallName('')).toBe('iphone');
    expect(normalizeCallName('   ')).toBe('iphone');
  });
  it('cuts a long name to 40 characters', () =>
    expect(normalizeCallName('n'.repeat(41))).toBe('n'.repeat(40)));
});

describe('installId', () => {
  it('makes four letters or digits once and keeps them', () => {
    const created = installId();
    expect(created).toMatch(/^[A-Z0-9]{4}$/);
    expect(installId(() => 0)).toBe(created);
  });
});
