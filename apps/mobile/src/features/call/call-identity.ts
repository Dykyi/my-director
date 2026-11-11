import { storedValue } from '@shared/stored-preference';

export const DEFAULT_CALL_NAME = 'iphone';
export const MAX_CALL_NAME_LENGTH = 40;
const INSTALL_ID_LENGTH = 4;
const INSTALL_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const storedText = (key: string) => storedValue(key, (stored) => stored ?? undefined, String);

export const callName = storedText('preferences.callName');
const storedInstallId = storedText('preferences.installId');

export const normalizeCallName = (value: string): string =>
  value.trim().slice(0, MAX_CALL_NAME_LENGTH) || DEFAULT_CALL_NAME;

/** Made on first use, so each install joins under its own identity; a reinstall gets a new one. */
export function installId(random: () => number = Math.random): string {
  const saved = storedInstallId.get();
  if (saved) return saved;
  const created = Array.from(
    { length: INSTALL_ID_LENGTH },
    () => INSTALL_ID_ALPHABET[Math.floor(random() * INSTALL_ID_ALPHABET.length)],
  ).join('');
  storedInstallId.set(created);
  return created;
}
