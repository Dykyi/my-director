import { useEffect, useEffectEvent } from 'react';
import { Linking } from 'react-native';

import { BackgroundUpload } from '@modules/background-upload';
import { CaptureCore } from '@modules/capture-core';

import { formatLogLine } from '../capture/format';
import { describeUpload } from '../upload/upload-format';
import { formatHealthLine } from './remote-format';

const STAND_LINK = /:\/\/stand\/([\w-]+)$/;
const HEALTH_LOG_INTERVAL_MS = 10_000;

export type RemoteCommands = Readonly<Record<string, () => unknown>>;

export function useRemoteControl(commands: RemoteCommands) {
  const perform = useEffectEvent(async (url: string) => {
    const name = STAND_LINK.exec(url)?.[1];
    const command = name === undefined ? undefined : commands[name];
    if (!command) {
      console.log(`stand: unknown action in ${url}, known: ${Object.keys(commands).join(', ')}`);
      return;
    }
    console.log(`stand: ${name}`);
    try {
      await command();
    } catch (error) {
      console.log(`stand: ${name} failed: ${String(error)}`);
    }
  });

  useEffect(() => {
    if (!__DEV__) return;
    let lastHealthLog = 0;
    const subscriptions = [
      Linking.addEventListener('url', ({ url }) => void perform(url)),
      CaptureCore.addListener('onLog', (entry) => console.log(formatLogLine(entry))),
      CaptureCore.addListener('onHealth', (health) => {
        const now = Date.now();
        if (now - lastHealthLog < HEALTH_LOG_INTERVAL_MS) return;
        lastHealthLog = now;
        console.log(`health ${formatHealthLine(health)}`);
      }),
      BackgroundUpload.addListener('onUploadChange', (upload) => console.log(`upload ${upload.objectKey} ${describeUpload(upload)}`)),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);
}
