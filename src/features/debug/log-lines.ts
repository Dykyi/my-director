import type { LogEntry } from '@modules/capture-core';

import { formatLogLine } from '@shared/format';

export function logLines({ data, ...entry }: LogEntry): { head: string; details: string[] } {
  return {
    head: formatLogLine(entry),
    details: Object.entries(data ?? {}).map(([key, value]) => `${key} ${value}`),
  };
}
