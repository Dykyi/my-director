import type { VoiceCatalog } from './voice-catalog.ts';

const NAME = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_SPEECH_CHARS = 500;

export class RequestError extends Error {}

export interface TokenRequest {
  room: string;
  identity: string;
}

export interface SpeechRequest {
  text: string;
  voice: string;
}

const fieldsOf = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

function requireName(value: unknown, field: string): string {
  if (typeof value !== 'string' || !NAME.test(value)) {
    throw new RequestError(`${field} must be 1 to 64 letters, digits, - or _`);
  }
  return value;
}

export function parseTokenRequest(body: unknown): TokenRequest {
  const { room, identity } = fieldsOf(body);
  return { room: requireName(room, 'room'), identity: requireName(identity, 'identity') };
}

export function parseSpeechRequest(body: unknown, voices: VoiceCatalog): SpeechRequest {
  const { text, voice } = fieldsOf(body);
  const line = typeof text === 'string' ? text.trim() : '';
  if (line.length === 0 || line.length > MAX_SPEECH_CHARS) {
    throw new RequestError(`text must be 1 to ${MAX_SPEECH_CHARS} characters`);
  }
  if (typeof voice !== 'string' || !voices.has(voice)) throw new RequestError('unknown voice');
  return { text: line, voice };
}
