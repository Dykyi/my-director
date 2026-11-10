import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import type { SpeechRequest } from './requests.ts';

const run = promisify(execFile);
const SPEECH_FORMAT = ['--file-format=m4af', '--data-format=aac'];
const NAME_LENGTH = 16;

export function speechFileName({ text, voice }: SpeechRequest): string {
  const hash = createHash('sha256').update(`${voice}\n${text}`).digest('hex');
  return `${hash.slice(0, NAME_LENGTH)}.m4a`;
}

const exists = (file: URL): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false,
  );

export class SpeechService {
  readonly #cache: URL;

  private constructor(cache: URL) {
    this.#cache = cache;
  }

  static async open(cache: URL): Promise<SpeechService> {
    await mkdir(cache, { recursive: true });
    return new SpeechService(cache);
  }

  async speak(request: SpeechRequest): Promise<Buffer> {
    const audio = new URL(speechFileName(request), this.#cache);
    if (!(await exists(audio))) {
      // The line goes through a file, so text that starts with "-" is never read as an option.
      const text = new URL(audio.href.replace(/\.m4a$/, '.txt'));
      await writeFile(text, request.text);
      const files = ['-f', fileURLToPath(text), '-o', fileURLToPath(audio)];
      await run('say', ['-v', request.voice, ...files, ...SPEECH_FORMAT]);
    }
    return readFile(audio);
  }
}
