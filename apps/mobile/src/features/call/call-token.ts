import { z } from 'zod';

import type { UploadApi } from '@modules/background-upload';
import type { CallCredentials } from '@modules/capture-core';

import { describeError } from '@shared/describe-error';

import { callName, DEFAULT_CALL_NAME, installId } from './call-identity';
import { lastCallTarget } from './call-target';

const grantSchema = z.object({
  url: z.url({ protocol: /^wss?$/ }),
  room: z.string().min(1),
  identity: z.string().min(1),
  token: z.string().min(1),
});
const refusalSchema = z.object({ error: z.string().min(1) });

export type CallGrant = z.infer<typeof grantSchema>;
type CallGrantRequest = { installId: string; name: string };
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const joinFailed = (reason: string) => new Error(`Could not join the call: ${reason}`);

/** The upload Worker signs LiveKit tokens too, so the app ships no token that expires. */
export async function requestCallGrant(
  api: UploadApi,
  request: CallGrantRequest,
  fetcher: Fetch = fetch,
): Promise<CallGrant> {
  const response = await fetcher(`${api.baseUrl}/livekit-token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${api.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  }).catch((error: unknown) => {
    throw joinFailed(describeError(error));
  });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const reason = refusalSchema.safeParse(body).data?.error;
    const status = `the token service answered ${response.status}`;
    throw joinFailed(reason ? `${status} (${reason})` : status);
  }
  const grant = grantSchema.safeParse(body);
  if (!grant.success) throw joinFailed('the token service sent no usable token');
  return grant.data;
}

/** Asks under this install's id and name, and remembers where the call led only once Start has joined. */
export async function joinCall(
  api: UploadApi,
  start: (credentials: CallCredentials) => Promise<unknown>,
  fetcher: Fetch = fetch,
): Promise<void> {
  const name = callName.get() ?? DEFAULT_CALL_NAME;
  const { url, room, identity, token } = await requestCallGrant(
    api,
    { installId: installId(), name },
    fetcher,
  );
  await start({ url, token });
  lastCallTarget.set({ serverUrl: url, room, identity });
}
