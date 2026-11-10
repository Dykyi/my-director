import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const VOICE_LINE = /^(.+?)\s+([a-z]{2,3}_[A-Za-z0-9]+)\s+#/;

export interface Voice {
  name: string;
  locale: string;
}

export function parseVoices(output: string): Voice[] {
  return output
    .split('\n')
    .flatMap((line) => {
      const [, name, locale] = VOICE_LINE.exec(line) ?? [];
      return name && locale ? [{ name: name.trim(), locale }] : [];
    })
    .sort(
      (a, b) =>
        Number(b.locale.startsWith('en')) - Number(a.locale.startsWith('en')) ||
        a.name.localeCompare(b.name),
    );
}

export class VoiceCatalog {
  readonly voices: readonly Voice[];

  constructor(voices: readonly Voice[]) {
    this.voices = voices;
  }

  static async load(): Promise<VoiceCatalog> {
    return new VoiceCatalog(parseVoices((await run('say', ['-v', '?'])).stdout));
  }

  has(name: string): boolean {
    return this.voices.some((voice) => voice.name === name);
  }
}
