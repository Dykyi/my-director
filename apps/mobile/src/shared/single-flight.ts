/** Calls made while `run` is pending share its promise instead of starting another run. */
export function singleFlight<T>(run: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () =>
    (pending ??= run().finally(() => {
      pending = undefined;
    }));
}
