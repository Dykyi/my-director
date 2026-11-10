import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { context, type BuildContext, type BuildOptions } from 'esbuild';

const PAGE_DIR = new URL('../page/', import.meta.url);
export const SCRIPT_PATH = '/app.js';
const STATIC_FILES: Record<string, { file: URL; type: string }> = {
  '/': { file: new URL('index.html', PAGE_DIR), type: 'text/html' },
  '/styles.css': { file: new URL('styles.css', PAGE_DIR), type: 'text/css' },
  '/script.txt': { file: new URL('../script.txt', import.meta.url), type: 'text/plain' },
};
const SCRIPT_BUILD = {
  entryPoints: [fileURLToPath(new URL('main.ts', PAGE_DIR))],
  outfile: 'app.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  sourcemap: 'inline',
  write: false,
  logLevel: 'silent',
} satisfies BuildOptions;

export interface PageFile {
  body: string | Buffer;
  type: string;
}

export class PageBundle {
  readonly #script: BuildContext<typeof SCRIPT_BUILD>;

  private constructor(script: BuildContext<typeof SCRIPT_BUILD>) {
    this.#script = script;
  }

  static async create(): Promise<PageBundle> {
    return new PageBundle(await context(SCRIPT_BUILD));
  }

  async file(pathname: string): Promise<PageFile | undefined> {
    if (pathname === SCRIPT_PATH) return { body: await this.#bundle(), type: 'text/javascript' };
    const page = STATIC_FILES[pathname];
    return page && { body: await readFile(page.file), type: page.type };
  }

  /** Rebuilt on every request as well; esbuild keeps the last build, so this takes milliseconds. */
  async #bundle(): Promise<string> {
    const [script] = (await this.#script.rebuild()).outputFiles;
    if (!script) throw new Error('esbuild returned no page script');
    return script.text;
  }
}
