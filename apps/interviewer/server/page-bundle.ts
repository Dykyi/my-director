import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderWebCss, type DesignTokens } from '@mydirector/design-system';
import { context, type BuildContext, type BuildOptions } from 'esbuild';

const PAGE_DIR = new URL('../page/', import.meta.url);
const SCRIPT_PATH = '/app.js';
const TOKENS_PATH = '/tokens.css';
const FONT_PATH = /^\/fonts\/(\w+)\.ttf$/;
// The page loads the same font files the app bundles.
const FONT_PACKAGES: Record<string, string> = {
  Inter: '@expo-google-fonts/inter',
  JetBrainsMono: '@expo-google-fonts/jetbrains-mono',
};
const TOKENS_FILE = fileURLToPath(import.meta.resolve('@mydirector/design-system/tokens.json'));
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

export async function tokensCss(): Promise<string> {
  return renderWebCss(JSON.parse(await readFile(TOKENS_FILE, 'utf8')) as DesignTokens, 'dark');
}

export async function fontFile(face: string): Promise<Buffer | undefined> {
  const [prefix = '', style] = face.split('_');
  const fontPackage = FONT_PACKAGES[prefix];
  if (!fontPackage || !style) return undefined;
  const file = fileURLToPath(import.meta.resolve(`${fontPackage}/${style}/${face}.ttf`));
  return readFile(file).catch(() => undefined);
}

interface PageFile {
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
    if (pathname === TOKENS_PATH) return { body: await tokensCss(), type: 'text/css' };
    const face = FONT_PATH.exec(pathname)?.[1];
    if (face) {
      const font = await fontFile(face);
      return font && { body: font, type: 'font/ttf' };
    }
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
