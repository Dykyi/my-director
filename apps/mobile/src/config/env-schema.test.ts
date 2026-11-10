import { describe, expect, it } from '@jest/globals';

import { readEnv } from './env-schema';

const valid = {
  EXPO_PUBLIC_LIVEKIT_URL: 'wss://mydirector-poc.livekit.cloud',
  EXPO_PUBLIC_LIVEKIT_TOKEN: 'token',
  EXPO_PUBLIC_UPLOAD_API_URL: 'https://upload.example.workers.dev',
  EXPO_PUBLIC_UPLOAD_API_TOKEN: 'secret',
};

describe('readEnv', () => {
  it('passes a complete .env.local through', () => expect(readEnv(valid)).toEqual(valid));

  it('names every missing key and points to the fix', () => {
    const read = () =>
      readEnv({
        ...valid,
        EXPO_PUBLIC_LIVEKIT_URL: undefined,
        EXPO_PUBLIC_UPLOAD_API_TOKEN: undefined,
      });
    expect(read).toThrow(/EXPO_PUBLIC_LIVEKIT_URL/);
    expect(read).toThrow(/EXPO_PUBLIC_UPLOAD_API_TOKEN/);
    expect(read).toThrow(/Copy \.env\.example to \.env\.local/);
  });

  it('wants a WebSocket URL for LiveKit', () =>
    expect(() =>
      readEnv({ ...valid, EXPO_PUBLIC_LIVEKIT_URL: 'https://mydirector-poc.livekit.cloud' }),
    ).toThrow(/EXPO_PUBLIC_LIVEKIT_URL/));

  it('rejects an empty token', () =>
    expect(() => readEnv({ ...valid, EXPO_PUBLIC_LIVEKIT_TOKEN: '' })).toThrow(
      /EXPO_PUBLIC_LIVEKIT_TOKEN/,
    ));
});
