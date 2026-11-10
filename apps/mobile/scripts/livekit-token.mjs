import { AccessToken } from 'livekit-server-sdk';

const ROOM = 'mydirector-poc';
const IDENTITY = 'iphone';
/** The phone's token is built into the app, so a TestFlight build calls for this long without a new build. */
const TOKEN_TTL = '20d';

const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error('Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in the root .env.local');
  process.exit(1);
}

const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
  identity: IDENTITY,
  ttl: TOKEN_TTL,
});
// Own metadata: the phone shares why it paused as a participant attribute.
token.addGrant({
  roomJoin: true,
  room: ROOM,
  canPublish: true,
  canSubscribe: true,
  canUpdateOwnMetadata: true,
});

console.log(
  `# room ${ROOM}, valid ${TOKEN_TTL}: paste into apps/mobile/.env.local and the EAS env, then rebuild the app`,
);
console.log(`EXPO_PUBLIC_LIVEKIT_URL=${LIVEKIT_URL}`);
console.log(`EXPO_PUBLIC_LIVEKIT_TOKEN=${await token.toJwt()}`);
