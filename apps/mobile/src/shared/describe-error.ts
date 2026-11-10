/** Expo wraps a native rejection as "…has failed (at …) → Caused by: SomeException: reason (at File.swift:12)". */
const NATIVE_CAUSE = /.*Caused by: \w+: (.+?) \(at [^)]*\)\s*$/s;

export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const reason = NATIVE_CAUSE.exec(error.message)?.[1] ?? error.message;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? `${code}: ${reason}` : reason;
}
