import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_LIVEKIT_URL: z.url({ protocol: /^wss?$/ }),
  EXPO_PUBLIC_LIVEKIT_TOKEN: z.string().min(1),
  EXPO_PUBLIC_UPLOAD_API_URL: z.url({ protocol: /^https?$/ }),
  EXPO_PUBLIC_UPLOAD_API_TOKEN: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: Record<keyof Env, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  throw new Error(
    `Invalid .env.local:\n${z.prettifyError(parsed.error)}\nCopy .env.example to .env.local and run yarn token.`,
  );
}
