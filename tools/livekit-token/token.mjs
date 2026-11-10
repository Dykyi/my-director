import { AccessToken } from 'livekit-server-sdk';

const ROOM = 'mydirector-poc';
const IDENTITY = 'iphone';
const TOKEN_TTL = '20d';

const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error('Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env.local');
  process.exit(1);
}

const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
  identity: IDENTITY,
  ttl: TOKEN_TTL,
});
token.addGrant({
  roomJoin: true,
  room: ROOM,
  canPublish: true,
  canSubscribe: true,
  canUpdateOwnMetadata: true,
});

console.log(
  `# room ${ROOM}, valid ${TOKEN_TTL}: paste into .env.local and the EAS env, then rebuild the app`,
);
console.log(`EXPO_PUBLIC_LIVEKIT_URL=${LIVEKIT_URL}`);
console.log(`EXPO_PUBLIC_LIVEKIT_TOKEN=${await token.toJwt()}`);
