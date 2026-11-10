import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { PageBundle } from './page-bundle.ts';
import { parseSpeechRequest, parseTokenRequest, RequestError } from './requests.ts';
import type { SpeechService } from './speech-service.ts';
import type { TokenService } from './token-service.ts';
import type { VoiceCatalog } from './voice-catalog.ts';

const MAX_BODY_BYTES = 16 * 1024;

export interface Services {
  page: PageBundle;
  tokens: TokenService;
  speech: SpeechService;
  voices: VoiceCatalog;
}

function send(response: ServerResponse, status: number, type: string, body: string | Buffer) {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  response.end(body);
}

const sendJson = (response: ServerResponse, status: number, value: unknown) =>
  send(response, status, 'application/json', JSON.stringify(value));

async function readJson(request: IncomingMessage): Promise<unknown> {
  // JSON only: a cross-site form cannot send it without a preflight this server never answers.
  if (!request.headers['content-type']?.startsWith('application/json')) {
    throw new RequestError('send JSON');
  }
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > MAX_BODY_BYTES) throw new RequestError('body too large');
  }
  return JSON.parse(body);
}

export class InterviewerServer {
  readonly #services: Services;
  readonly #server: Server;

  constructor(services: Services) {
    this.#services = services;
    this.#server = createServer((request, response) => {
      this.#route(request, response).catch((error: unknown) => this.#fail(response, error));
    });
  }

  listen(port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#server.once('error', reject);
      this.#server.listen(port, host, resolve);
    });
  }

  async #route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const { page, tokens, speech, voices } = this.#services;
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    const route = `${request.method} ${pathname}`;
    if (route === 'GET /voices') return sendJson(response, 200, voices.voices);
    if (route === 'POST /token') {
      return sendJson(response, 200, await tokens.mint(parseTokenRequest(await readJson(request))));
    }
    if (route === 'POST /speech') {
      const audio = await speech.speak(parseSpeechRequest(await readJson(request), voices));
      return send(response, 200, 'audio/mp4', audio);
    }
    const file = request.method === 'GET' ? await page.file(pathname) : undefined;
    if (file) return send(response, 200, `${file.type}; charset=utf-8`, file.body);
    sendJson(response, 404, { error: 'not found' });
  }

  #fail(response: ServerResponse, error: unknown) {
    const known = error instanceof RequestError || error instanceof SyntaxError;
    if (!known) console.error(error);
    sendJson(response, known ? 400 : 500, { error: known ? error.message : 'internal error' });
  }
}
