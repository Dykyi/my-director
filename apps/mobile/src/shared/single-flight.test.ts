import { describe, expect, it, jest } from '@jest/globals';

import { singleFlight } from './single-flight';

function deferred() {
  let resolve: (value: string) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<string>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

describe('singleFlight', () => {
  it('gives a second call the first one while it runs', async () => {
    const first = deferred();
    const run = jest.fn(() => first.promise);
    const start = singleFlight(run);
    const calls = [start(), start()];
    first.resolve('joined');
    await expect(Promise.all(calls)).resolves.toEqual(['joined', 'joined']);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs again once the first call has finished', async () => {
    const run = jest.fn(async () => 'joined');
    const start = singleFlight(run);
    await start();
    await start();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('runs again after a failure', async () => {
    const failed = deferred();
    const run = jest
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(failed.promise)
      .mockResolvedValueOnce('joined');
    const start = singleFlight(run);
    const first = start();
    failed.reject(new Error('offline'));
    await expect(first).rejects.toThrow('offline');
    await expect(start()).resolves.toBe('joined');
  });
});
