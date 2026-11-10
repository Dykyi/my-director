// yarn interviewer [name]: serves the interviewer page on this Mac and opens it in Chrome.

import { InterviewerServer } from './interviewer-server.ts';
import { PageBundle } from './page-bundle.ts';
import { runProcess } from './run-process.ts';
import { SpeechService } from './speech-service.ts';
import { TokenService } from './token-service.ts';
import { VoiceCatalog } from './voice-catalog.ts';

const HOST = '127.0.0.1';
const PORT = 8080;
const ORIGIN = `http://localhost:${PORT}`;
const SPEECH_CACHE = new URL('../.speech-cache/', import.meta.url);
const guest = process.argv[2];
const PAGE = guest ? `${ORIGIN}/?${new URLSearchParams({ as: guest })}` : ORIGIN;

/** Chrome records WebM, which the echo check reads. */
const openPage = () =>
  runProcess('open', ['-a', 'Google Chrome', PAGE]).catch(() => runProcess('open', [PAGE]));

async function reuseRunningServer(error: unknown): Promise<never> {
  if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
  const ours = await fetch(`${ORIGIN}/voices`).then(
    (response) => response.ok,
    () => false,
  );
  if (!ours) {
    console.error(
      `Port ${PORT} is taken by another program; stop it and run yarn interviewer again.`,
    );
    process.exit(1);
  }
  await openPage();
  console.log(`The interviewer page is already served at ${ORIGIN}; opened ${PAGE}`);
  process.exit(0);
}

const { LIVEKIT_URL: url, LIVEKIT_API_KEY: apiKey, LIVEKIT_API_SECRET: apiSecret } = process.env;
if (!url || !apiKey || !apiSecret) {
  console.error('Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env.local');
  process.exit(1);
}

const voices = await VoiceCatalog.load();
const server = new InterviewerServer({
  tokens: new TokenService({ url, apiKey, apiSecret }),
  speech: await SpeechService.open(SPEECH_CACHE),
  page: await PageBundle.create(),
  voices,
});
await server.listen(PORT, HOST).catch(reuseRunningServer);
await openPage();
console.log(
  `Interviewer page: ${PAGE} (Ctrl+C stops it). ${voices.voices.length} voices on this Mac.`,
);
