import type { UploadApi } from '@modules/background-upload';
import type { CallCredentials } from '@modules/capture-core';

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env.local and run npm run token.`);
  return value;
}

export function callCredentials(): CallCredentials {
  return {
    url: required('EXPO_PUBLIC_LIVEKIT_URL', process.env.EXPO_PUBLIC_LIVEKIT_URL),
    token: required('EXPO_PUBLIC_LIVEKIT_TOKEN', process.env.EXPO_PUBLIC_LIVEKIT_TOKEN),
  };
}

export function uploadApi(): UploadApi {
  return {
    baseUrl: required('EXPO_PUBLIC_UPLOAD_API_URL', process.env.EXPO_PUBLIC_UPLOAD_API_URL),
    token: required('EXPO_PUBLIC_UPLOAD_API_TOKEN', process.env.EXPO_PUBLIC_UPLOAD_API_TOKEN),
  };
}
