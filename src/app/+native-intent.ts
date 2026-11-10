import { standAction } from '@features/remote/stand-routes';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  return standAction(path) === undefined ? path : null;
}
