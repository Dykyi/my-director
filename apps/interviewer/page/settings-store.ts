export type AskerMode = 'voice' | 'microphone';

export const FLOW_MODES = ['questions', 'reading'] as const;
export type FlowMode = (typeof FLOW_MODES)[number];

export interface Settings {
  room: string;
  identity: string;
  phone: string;
  asker: AskerMode;
  voice: string;
  quietSec: number;
  mode: FlowMode;
  readingMinutes: number;
  startOnJoin: boolean;
  loop: boolean;
  recordOnJoin: boolean;
  statsCsv: boolean;
  statsOverlay: boolean;
  hearPhone: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  room: 'mydirector-poc',
  identity: 'interviewer',
  phone: 'iphone',
  asker: 'voice',
  voice: 'Samantha',
  quietSec: 20,
  mode: 'questions',
  readingMinutes: 10,
  startOnJoin: true,
  loop: false,
  recordOnJoin: true,
  statsCsv: true,
  statsOverlay: true,
  hearPhone: false,
});

export const MIN_QUIET_SEC = 3;
export const MAX_QUIET_SEC = 120;

export function clampQuietSec(value: number, fallback: number): number {
  if (!value) return fallback;
  return Math.min(MAX_QUIET_SEC, Math.max(MIN_QUIET_SEC, Math.round(value)));
}

export const MIN_READING_MINUTES = 1;
export const MAX_READING_MINUTES = 60;

export function clampReadingMinutes(value: number, fallback: number): number {
  if (!value) return fallback;
  return Math.min(MAX_READING_MINUTES, Math.max(MIN_READING_MINUTES, Math.round(value)));
}

const SETTINGS_KEY = 'interviewer.settings';
const SCRIPT_KEY = 'interviewer.script';
const READING_KEY = 'interviewer.reading';

/** Settings that take one of a few words; any other saved word falls back to the default. */
const CHOICES: Partial<Record<keyof Settings, readonly unknown[]>> = { mode: FLOW_MODES };

const fits = (key: string, value: unknown, fallback: unknown): boolean =>
  typeof value === typeof fallback && (CHOICES[key as keyof Settings]?.includes(value) ?? true);

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export class SettingsStore {
  readonly #storage: KeyValueStorage;

  constructor(storage: KeyValueStorage) {
    this.#storage = storage;
  }

  load(): Settings {
    const saved = this.#saved();
    const entries = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => [
      key,
      fits(key, saved[key], value) ? saved[key] : value,
    ]);
    return Object.fromEntries(entries) as Settings;
  }

  save(settings: Settings): void {
    this.#storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  loadScript(): string | null {
    return this.#storage.getItem(SCRIPT_KEY);
  }

  saveScript(text: string): void {
    this.#storage.setItem(SCRIPT_KEY, text);
  }

  loadReading(): string | null {
    return this.#storage.getItem(READING_KEY);
  }

  saveReading(text: string): void {
    this.#storage.setItem(READING_KEY, text);
  }

  reset(): void {
    this.#storage.removeItem(SETTINGS_KEY);
    this.#storage.removeItem(SCRIPT_KEY);
    this.#storage.removeItem(READING_KEY);
  }

  #saved(): Record<string, unknown> {
    try {
      return JSON.parse(this.#storage.getItem(SETTINGS_KEY) ?? '{}') ?? {};
    } catch {
      return {};
    }
  }
}
