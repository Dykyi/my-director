import type { UploadApi } from '@modules/background-upload';

import { readEnv } from './env-schema';

/** Expo inlines EXPO_PUBLIC_* only for dot access to process.env. */
export const env = readEnv({
  EXPO_PUBLIC_UPLOAD_API_URL: process.env.EXPO_PUBLIC_UPLOAD_API_URL,
  EXPO_PUBLIC_UPLOAD_API_TOKEN: process.env.EXPO_PUBLIC_UPLOAD_API_TOKEN,
});

/** POC only: the Worker token ships inside the app; in production MyDirector's API signs uploads and call tokens. */
export const uploadApi: UploadApi = {
  baseUrl: env.EXPO_PUBLIC_UPLOAD_API_URL,
  token: env.EXPO_PUBLIC_UPLOAD_API_TOKEN,
};
