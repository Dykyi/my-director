export type AskerMode = 'voice' | 'microphone';

export interface Settings {
  room: string;
  identity: string;
  phone: string;
  asker: AskerMode;
  voice: string;
  quietSec: number;
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

const SETTINGS_KEY = 'interviewer.settings';
const SCRIPT_KEY = 'interviewer.script';

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
      typeof saved[key] === typeof value ? saved[key] : value,
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

  reset(): void {
    this.#storage.removeItem(SETTINGS_KEY);
    this.#storage.removeItem(SCRIPT_KEY);
  }

  #saved(): Record<string, unknown> {
    try {
      return JSON.parse(this.#storage.getItem(SETTINGS_KEY) ?? '{}') ?? {};
    } catch {
      return {};
    }
  }
}
