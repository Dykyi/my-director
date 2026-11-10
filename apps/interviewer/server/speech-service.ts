import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { SpeechRequest } from './requests.ts';
import { runProcess } from './run-process.ts';

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

type Run = (file: string, args: string[]) => Promise<unknown>;

export class SpeechService {
  readonly #cache: URL;
  readonly #run: Run;
  readonly #inFlight = new Map<string, Promise<void>>();

  private constructor(cache: URL, run: Run) {
    this.#cache = cache;
    this.#run = run;
  }

  static async open(cache: URL, run: Run = runProcess): Promise<SpeechService> {
    await mkdir(cache, { recursive: true });
    return new SpeechService(cache, run);
  }

  async speak(request: SpeechRequest): Promise<Buffer> {
    const audio = new URL(speechFileName(request), this.#cache);
    if (!(await exists(audio))) await this.#record(audio, request);
    return readFile(audio);
  }

  #record(audio: URL, request: SpeechRequest): Promise<void> {
    let recording = this.#inFlight.get(audio.href);
    if (!recording) {
      recording = this.#say(audio, request).finally(() => this.#inFlight.delete(audio.href));
      this.#inFlight.set(audio.href, recording);
    }
    return recording;
  }

  // say writes beside the cache entry and the rename publishes it whole, so a cut-off run is never served.
  async #say(audio: URL, { text, voice }: SpeechRequest): Promise<void> {
    // The line goes through a file, so text that starts with "-" is never read as an option.
    const line = new URL(audio.href.replace(/\.m4a$/, '.txt'));
    const partial = new URL(audio.href.replace(/\.m4a$/, '.partial.m4a'));
    await writeFile(line, text);
    const files = ['-f', fileURLToPath(line), '-o', fileURLToPath(partial)];
    await this.#run('say', ['-v', voice, ...files, ...SPEECH_FORMAT]);
    await rename(partial, audio);
  }
}
