import type { RoomAccess } from '../server/token-service.ts';
import type { Voice } from '../server/voice-catalog.ts';

async function post(path: string, body: unknown): Promise<Response> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.json()).error);
  return response;
}

export const fetchVoices = async (): Promise<Voice[]> => (await fetch('/voices')).json();

export const fetchDefaultScript = async (): Promise<string> => (await fetch('/script.txt')).text();

export const fetchRoomAccess = async (room: string, identity: string): Promise<RoomAccess> =>
  (await post('/token', { room, identity })).json();

export const fetchSpeech = async (text: string, voice: string): Promise<Blob> =>
  (await post('/speech', { text, voice })).blob();
