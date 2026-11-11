import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { Asker } from './asker.ts';

class FakeStream {
  stopped = false;
  getTracks = () => [{ stop: () => (this.stopped = true) }];
}

function fakeContext() {
  const bus = { stream: {}, sources: new Set<unknown>() };
  const context = {
    createMediaStreamDestination: () => bus,
    createMediaElementSource: () => ({ connect() {} }),
    createMediaStreamSource: (mediaStream: FakeStream) => {
      const source = {
        mediaStream,
        connect: () => bus.sources.add(source),
        disconnect: () => bus.sources.delete(source),
      };
      return source;
    },
  };
  return { context: context as unknown as AudioContext, bus };
}

const speech = { addEventListener() {}, pause() {} } as unknown as HTMLAudioElement;

let openings: { stream: FakeStream; open: () => void }[];

beforeEach(() => {
  openings = [];
  const getUserMedia = () =>
    new Promise((resolve) => {
      const stream = new FakeStream();
      openings.push({ stream, open: () => resolve(stream) });
    });
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('Asker voice on this Mac', () => {
  it('plays the voice here once and stops only that, keeping it in the call', () => {
    const output = { name: 'speakers' };
    const calls: string[] = [];
    const voice = {
      connect: (to: unknown) => calls.push(to === output ? 'speakers on' : 'call on'),
      disconnect: (from: unknown) => calls.push(from === output ? 'speakers off' : 'call off'),
    };
    const context = {
      destination: output,
      createMediaStreamDestination: () => ({ stream: {} }),
      createMediaElementSource: () => voice,
    } as unknown as AudioContext;
    const asker = new Asker(context, speech, () => {});
    asker.hear(true);
    asker.hear(true);
    asker.hear(false);
    asker.hear(false);
    assert.deepEqual(calls, ['call on', 'speakers on', 'speakers off']);
  });
});

describe('Asker microphone', () => {
  it('stays closed when it is turned off before the browser opens it', async () => {
    const { context, bus } = fakeContext();
    const asker = new Asker(context, speech, () => {});
    const on = asker.useMicrophone(true);
    await asker.useMicrophone(false);
    openings[0]?.open();
    await on;
    assert.equal(openings[0]?.stream.stopped, true);
    assert.equal(bus.sources.size, 0);
  });

  it('keeps only the latest of two openings', async () => {
    const { context, bus } = fakeContext();
    const asker = new Asker(context, speech, () => {});
    const first = asker.useMicrophone(true);
    const second = asker.useMicrophone(true);
    openings[1]?.open();
    openings[0]?.open();
    await Promise.all([first, second]);
    assert.equal(openings[0]?.stream.stopped, true);
    assert.equal(openings[1]?.stream.stopped, false);
    assert.equal(bus.sources.size, 1);
  });
});
