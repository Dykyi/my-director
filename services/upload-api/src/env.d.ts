// Secrets only, so wrangler.jsonc names no account.
interface Env {
  B2_S3_ENDPOINT: string;
  B2_BUCKET: string;
  B2_KEY_ID: string;
  B2_APPLICATION_KEY: string;
  UPLOAD_API_TOKEN: string;
  LIVEKIT_URL: string;
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
}
