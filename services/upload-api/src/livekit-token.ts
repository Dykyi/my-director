import { AccessToken } from 'livekit-server-sdk';

import { asObject, InputError } from './validation.ts';

export const DEFAULT_CALL_NAME = 'iphone';
const PHONE_IDENTITY_PREFIX = 'iphone';
const MAX_NAME_LENGTH = 40;
// Resume rejoins with the token from Start, so it outlives a pause overnight; the next Start asks again.
const TOKEN_TTL = '24h';
const INSTALL_ID = /^[A-Za-z0-9]{4,16}$/;

export type LiveKitTokenRequest = { installId: string; name: string };
export type LiveKitConfig = { url: string; room: string; apiKey: string; apiSecret: string };
export type LiveKitGrant = { url: string; room: string; identity: string; token: string };

export function parseTokenRequest(body: unknown): LiveKitTokenRequest {
  const { installId, name } = asObject(body);
  if (typeof installId !== 'string' || !INSTALL_ID.test(installId))
    throw new InputError('installId must be 4 to 16 letters or digits');
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length > MAX_NAME_LENGTH)
    throw new InputError(`name must be at most ${MAX_NAME_LENGTH} characters`);
  return { installId, name: trimmed || DEFAULT_CALL_NAME };
}

export async function issueLiveKitToken(
  request: LiveKitTokenRequest,
  config: LiveKitConfig,
): Promise<LiveKitGrant> {
  const identity = `${PHONE_IDENTITY_PREFIX}-${request.installId}`;
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity,
    name: request.name,
    ttl: TOKEN_TTL,
  });
  // Own metadata: the pause reason attribute and renaming mid-call.
  token.addGrant({
    roomJoin: true,
    room: config.room,
    canPublish: true,
    canSubscribe: true,
    canUpdateOwnMetadata: true,
  });
  return { url: config.url, room: config.room, identity, token: await token.toJwt() };
}
