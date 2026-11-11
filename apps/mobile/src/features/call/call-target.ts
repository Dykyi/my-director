import { z } from 'zod';

import { storedValue } from '@shared/stored-preference';

const targetSchema = z.object({
  serverUrl: z.string().min(1),
  room: z.string().min(1),
  identity: z.string().min(1),
});

export type CallTarget = z.infer<typeof targetSchema>;

export const NOT_JOINED = 'not joined yet';

export function parseCallTarget(stored: string | null): CallTarget | undefined {
  if (stored === null) return undefined;
  try {
    return targetSchema.safeParse(JSON.parse(stored)).data;
  } catch {
    return undefined;
  }
}

export const lastCallTarget = storedValue(
  'preferences.callTarget',
  parseCallTarget,
  JSON.stringify,
);
