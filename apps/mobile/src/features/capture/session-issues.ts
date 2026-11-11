import type { LogEntry, SessionPhase, SessionSnapshot } from '@modules/capture-core';

import { formatTimer } from '@shared/format';
import { MS_PER_SEC } from '@shared/units';
import type { TabBadge } from '@ui/tab-bar';

import { isCameraLive } from './session-labels';

type IssueSeverity = 'warning' | 'error';
export type SessionIssue = { severity: IssueSeverity; text: string; at: string };
export type HealthLineView =
  | { tone: 'ok'; text: string }
  | { tone: 'quiet'; text: string }
  | { tone: IssueSeverity; text: string; detail?: string };

const PAUSED_PHASES: ReadonlySet<SessionPhase> = new Set(['pausing', 'paused', 'resuming']);

const isIssue = (entry: LogEntry): entry is LogEntry & { level: IssueSeverity } =>
  entry.level === 'warning' || entry.level === 'error';

/** Logged issues count from `since`: Start for the Debug badge, the last Start or Resume for the health line. */
export function sessionIssues(
  { error, warnings, startedAt }: SessionSnapshot,
  logs: LogEntry[],
  since = startedAt,
): SessionIssue[] {
  const logged =
    since === undefined ? [] : logs.filter(isIssue).filter((entry) => entry.at >= since);
  return [
    ...(error ? [{ severity: 'error' as const, text: error.message, at: error.at }] : []),
    ...warnings.map((warning) => ({
      severity: 'warning' as const,
      text: warning.message,
      at: warning.since,
    })),
    ...logged.map((entry) => ({ severity: entry.level, text: entry.message, at: entry.at })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

function calmText(phase: SessionPhase): string {
  if (!isCameraLive(phase)) return 'Camera off';
  return phase === 'ready' ? 'Camera and microphone ready' : 'File, camera and audio all normal';
}

const worstOf = (issues: SessionIssue[]) =>
  issues.find((issue) => issue.severity === 'error') ?? issues[0];

export const WAITING_FOR_ACCESS: HealthLineView = {
  tone: 'quiet',
  text: 'Waiting for camera and microphone access',
};

export function healthLine(
  issues: SessionIssue[],
  { phase, startedAt }: Pick<SessionSnapshot, 'phase' | 'startedAt'>,
): HealthLineView {
  const worst = worstOf(issues);
  if (worst) {
    const detail =
      startedAt === undefined
        ? undefined
        : `at ${formatTimer((Date.parse(worst.at) - Date.parse(startedAt)) / MS_PER_SEC)}`;
    return { tone: worst.severity, text: worst.text, detail };
  }
  if (PAUSED_PHASES.has(phase)) return { tone: 'quiet', text: 'Microphone off while paused' };
  return { tone: 'ok', text: calmText(phase) };
}

export function issueBadge(issues: SessionIssue[]): TabBadge | undefined {
  const worst = worstOf(issues);
  return worst && { count: issues.length, severity: worst.severity };
}
