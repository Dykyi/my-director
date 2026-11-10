import { createContext, use, type ReactNode } from 'react';

const NO_PROVIDER = Symbol('no provider');

export function createHookContext<T>(name: string, useValue: () => T) {
  const Context = createContext<T | typeof NO_PROVIDER>(NO_PROVIDER);
  function Provider({ children }: { children: ReactNode }) {
    return <Context value={useValue()}>{children}</Context>;
  }
  function useContextValue(): T {
    const value = use(Context);
    if (value === NO_PROVIDER) throw new Error(`${name} is read outside its provider`);
    return value;
  }
  return [Provider, useContextValue] as const;
}
