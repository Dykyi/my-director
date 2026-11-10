import { writeFileSync } from 'node:fs';
import { AccessToken } from 'livekit-server-sdk';

const ROOM = 'mydirector-poc';
const TOKEN_TTL = '7d';
const INTERVIEWER_PAGE = 'http://localhost:8080/';
const INTERVIEWER_CREDENTIALS = new URL('../interviewer/credentials.json', import.meta.url);

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
writeFileSync(
  INTERVIEWER_CREDENTIALS,
  JSON.stringify({ url: LIVEKIT_URL, token: interviewerToken }),
);

const extraIdentities = process.argv.slice(2);
for (const identity of extraIdentities) {
  const file = new URL(`../interviewer/credentials-${identity}.json`, import.meta.url);
  writeFileSync(file, JSON.stringify({ url: LIVEKIT_URL, token: await tokenFor(identity) }));
}

console.log('# paste into .env.local, then rebuild the app');
console.log(`EXPO_PUBLIC_LIVEKIT_URL=${LIVEKIT_URL}`);
console.log(`EXPO_PUBLIC_LIVEKIT_TOKEN=${phoneToken}`);
console.log('');
console.log(`# interviewer page (room ${ROOM}, valid ${TOKEN_TTL})`);
console.log(`${INTERVIEWER_PAGE}#${pageHash}`);
console.log(`# or open ${INTERVIEWER_PAGE} as is: it reads tools/interviewer/credentials.json`);
for (const identity of extraIdentities)
  console.log(`# ${identity}: ${INTERVIEWER_PAGE}?as=${identity}`);
