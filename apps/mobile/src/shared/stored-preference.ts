import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

export function parsePreference<T extends string>(
  stored: string | null,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((value) => value === stored);
}

export function storedValue<T>(
  key: string,
  parse: (stored: string | null) => T | undefined,
  serialize: (value: T) => string,
) {
  const listeners = new Set<() => void>();
  let cache: { value: T | undefined } | undefined;
  const get = () => (cache ??= { value: parse(Storage.getItemSync(key)) }).value;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {
    get,
    set(value: T | undefined) {
      if (value === undefined) Storage.removeItemSync(key);
      else Storage.setItemSync(key, serialize(value));
      cache = { value };
      listeners.forEach((listener) => listener());
    },
    subscribe,
    use: () => useSyncExternalStore(subscribe, get),
  };
}

export const storedPreference = <T extends string>(key: string, allowed: readonly T[]) =>
  storedValue(key, (stored) => parsePreference(stored, allowed), String);
