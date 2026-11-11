import { describe, expect, it } from '@jest/globals';

import { readEnv } from './env-schema';

const valid = {
  EXPO_PUBLIC_UPLOAD_API_URL: 'https://upload.example.workers.dev',
  EXPO_PUBLIC_UPLOAD_API_TOKEN: 'secret',
};

describe('readEnv', () => {
  it('passes a complete .env.local through', () => expect(readEnv(valid)).toEqual(valid));

  it('names every missing key and points to the fix', () => {
    const read = () =>
      readEnv({ EXPO_PUBLIC_UPLOAD_API_URL: undefined, EXPO_PUBLIC_UPLOAD_API_TOKEN: undefined });
    expect(read).toThrow(/EXPO_PUBLIC_UPLOAD_API_URL/);
    expect(read).toThrow(/EXPO_PUBLIC_UPLOAD_API_TOKEN/);
    expect(read).toThrow(/Copy \.env\.example to \.env\.local and fill it in\.$/);
  });

  it('wants an HTTP URL for the Worker', () =>
    expect(() =>
      readEnv({ ...valid, EXPO_PUBLIC_UPLOAD_API_URL: 'wss://upload.example.workers.dev' }),
    ).toThrow(/EXPO_PUBLIC_UPLOAD_API_URL/));

  it('rejects an empty token', () =>
    expect(() => readEnv({ ...valid, EXPO_PUBLIC_UPLOAD_API_TOKEN: '' })).toThrow(
      /EXPO_PUBLIC_UPLOAD_API_TOKEN/,
    ));
});
