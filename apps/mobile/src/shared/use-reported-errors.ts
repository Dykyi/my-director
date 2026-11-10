import { useCallback, useState } from 'react';

import { describeError } from './describe-error';

export function useReportedErrors() {
  const [error, setError] = useState<string | null>(null);

  const reportError = useCallback((caught: unknown) => setError(describeError(caught)), []);

  const guard = useCallback(
    async (action: () => Promise<void>) => {
      setError(null);
      try {
        await action();
        return true;
      } catch (caught) {
        reportError(caught);
        return false;
      }
    },
    [reportError],
  );

  return { error, reportError, guard };
}
