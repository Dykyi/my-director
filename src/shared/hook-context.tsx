import { createContext, use, type ReactNode } from 'react';

export function hookContext<T>(name: string, useValue: () => T) {
  const Context = createContext<T | null>(null);
  function Provider({ children }: { children: ReactNode }) {
    return <Context value={useValue()}>{children}</Context>;
  }
  function useContextValue(): T {
    const value = use(Context);
    if (value === null) throw new Error(`${name} is read outside its provider`);
    return value;
  }
  return [Provider, useContextValue] as const;
}
