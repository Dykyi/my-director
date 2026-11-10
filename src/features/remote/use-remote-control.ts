import { useEffect, useEffectEvent, useState } from 'react';
import { Linking } from 'react-native';

import { BackgroundUpload } from '@modules/background-upload';
import { CaptureCore } from '@modules/capture-core';

import { describeUpload } from '@features/upload/upload-format';
import { formatLogLine } from '@shared/format';

import { formatHealthLine, formatRoomLine } from './remote-format';
import { standAction } from './stand-routes';

const HEALTH_LOG_INTERVAL_MS = 10_000;

export type RemoteCommands = Readonly<Record<string, () => unknown>>;

export function useRemoteControl(commands: RemoteCommands) {
  const [lastCommand, setLastCommand] = useState<{ name: string; at: string }>();

  const perform = useEffectEvent(async (url: string) => {
    const name = standAction(url);
    if (name === undefined) return;
    const command = commands[name];
    if (!command) {
      console.log(`stand: unknown action ${name}, known: ${Object.keys(commands).join(', ')}`);
      return;
    }
    console.log(`stand: ${name}`);
    setLastCommand({ name, at: new Date().toISOString() });
    try {
      await command();
    } catch (error) {
      console.log(`stand: ${name} failed: ${String(error)}`);
    }
  });

  useEffect(() => {
    if (!__DEV__) return;
    let lastHealthLog = 0;
    let lastRoomLine = '';
    const subscriptions = [
      Linking.addEventListener('url', ({ url }) => void perform(url)),
      CaptureCore.addListener('onLog', (entry) => console.log(formatLogLine(entry))),
      CaptureCore.addListener('onHealth', (health) => {
        const now = Date.now();
        if (now - lastHealthLog < HEALTH_LOG_INTERVAL_MS) return;
        lastHealthLog = now;
        console.log(`health ${formatHealthLine(health)}`);
      }),
      CaptureCore.addListener('onStateChange', ({ call }) => {
        const line = formatRoomLine(call);
        if (line === lastRoomLine) return;
        lastRoomLine = line;
        console.log(line);
      }),
      BackgroundUpload.addListener('onUploadChange', (upload) =>
        console.log(`upload ${upload.objectKey} ${describeUpload(upload)}`),
      ),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return { lastCommand };
}
