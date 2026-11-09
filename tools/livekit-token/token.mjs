import { AccessToken } from 'livekit-server-sdk';

const ROOM = 'mydirector-poc';
const TOKEN_TTL = '7d';
const INTERVIEWER_PAGE = 'http://localhost:8080/';

const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error('Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env.local');
  process.exit(1);
}

async function tokenFor(identity) {
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, ttl: TOKEN_TTL });
  token.addGrant({ roomJoin: true, room: ROOM, canPublish: true, canSubscribe: true });
  return token.toJwt();
}

const phoneToken = await tokenFor('iphone');
const interviewerToken = await tokenFor('interviewer');
const pageHash = new URLSearchParams({ url: LIVEKIT_URL, token: interviewerToken });

console.log('# paste into .env.local, then rebuild the app');
console.log(`EXPO_PUBLIC_LIVEKIT_URL=${LIVEKIT_URL}`);
console.log(`EXPO_PUBLIC_LIVEKIT_TOKEN=${phoneToken}`);
console.log('');
console.log(`# interviewer page (room ${ROOM}, valid ${TOKEN_TTL})`);
console.log(`${INTERVIEWER_PAGE}#${pageHash}`);
