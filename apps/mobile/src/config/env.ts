import type { UploadApi } from '@modules/background-upload';
import type { CallCredentials } from '@modules/capture-core';

import { readEnv } from './env-schema';
import { tokenGrant, type CallTarget } from './token-grant';

export const env = readEnv({
  EXPO_PUBLIC_LIVEKIT_URL: process.env.EXPO_PUBLIC_LIVEKIT_URL,
  EXPO_PUBLIC_LIVEKIT_TOKEN: process.env.EXPO_PUBLIC_LIVEKIT_TOKEN,
  EXPO_PUBLIC_UPLOAD_API_URL: process.env.EXPO_PUBLIC_UPLOAD_API_URL,
  EXPO_PUBLIC_UPLOAD_API_TOKEN: process.env.EXPO_PUBLIC_UPLOAD_API_TOKEN,
});

export const callCredentials: CallCredentials = {
  url: env.EXPO_PUBLIC_LIVEKIT_URL,
  token: env.EXPO_PUBLIC_LIVEKIT_TOKEN,
};

/** POC only: the upload token ships inside the app; in production MyDirector's API signs uploads. */
export const uploadApi: UploadApi = {
  baseUrl: env.EXPO_PUBLIC_UPLOAD_API_URL,
  token: env.EXPO_PUBLIC_UPLOAD_API_TOKEN,
};

export const callTarget: CallTarget = {
  serverUrl: callCredentials.url,
  ...tokenGrant(callCredentials.token),
};
