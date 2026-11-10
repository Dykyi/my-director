import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

export function parsePreference<T extends string>(
  stored: string | null,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((value) => value === stored);
}

export function storedPreference<T extends string>(key: string, allowed: readonly T[]) {
  const listeners = new Set<() => void>();
  let cache: { value: T | undefined } | undefined;
  const get = () => (cache ??= { value: parsePreference(Storage.getItemSync(key), allowed) }).value;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {
    get,
    set(value: T | undefined) {
      if (value === undefined) Storage.removeItemSync(key);
      else Storage.setItemSync(key, value);
      cache = { value };
      listeners.forEach((listener) => listener());
    },
    use: () => useSyncExternalStore(subscribe, get),
  };
}
