import type { LogEntry, SessionPhase, SessionSnapshot } from '@modules/capture-core';

import { formatTimer } from '@shared/format';

export type IssueSeverity = 'warning' | 'error';
export type SessionIssue = { severity: IssueSeverity; text: string; at: string };
export type HealthLineView =
  { tone: 'ok' | 'paused'; text: string } | { tone: IssueSeverity; text: string; detail?: string };
export type IssueBadge = { count: number; severity: IssueSeverity };

const MS_PER_SEC = 1_000;
const CAMERA_OFF_PHASES: ReadonlySet<SessionPhase> = new Set(['idle', 'preparing']);
const PAUSED_PHASES: ReadonlySet<SessionPhase> = new Set(['pausing', 'paused', 'resuming']);

const isIssue = (entry: LogEntry): entry is LogEntry & { level: IssueSeverity } =>
  entry.level === 'warning' || entry.level === 'error';

export function sessionIssues(
  { error, warnings, startedAt }: SessionSnapshot,
  logs: LogEntry[],
): SessionIssue[] {
  const logged =
    startedAt === undefined ? [] : logs.filter(isIssue).filter((entry) => entry.at >= startedAt);
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
  if (CAMERA_OFF_PHASES.has(phase)) return 'Camera off';
  return phase === 'ready' ? 'Camera and microphone ready' : 'File, camera and audio all normal';
}

const worstOf = (issues: SessionIssue[]) =>
  issues.find((issue) => issue.severity === 'error') ?? issues[0];

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
  if (PAUSED_PHASES.has(phase)) return { tone: 'paused', text: 'Microphone off while paused' };
  return { tone: 'ok', text: calmText(phase) };
}

export function issueBadge(issues: SessionIssue[]): IssueBadge | undefined {
  const worst = worstOf(issues);
  return worst && { count: issues.length, severity: worst.severity };
}
