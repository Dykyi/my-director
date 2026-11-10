import { standAction } from '@features/remote/stand-routes';

/** Stand links run a command (useRemoteControl) and never navigate. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  return standAction(path) === undefined ? path : null;
}
