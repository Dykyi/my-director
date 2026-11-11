/** Stands in for expo-sqlite/kv-store. Import it as `mockKvStore`: a jest.mock factory may only use `mock…` names. */
const items = new Map<string, string>();

export const memoryKvStore = {
  __esModule: true,
  default: {
    getItemSync: (key: string) => items.get(key) ?? null,
    setItemSync: (key: string, value: string) => void items.set(key, value),
    removeItemSync: (key: string) => items.delete(key),
  },
};
