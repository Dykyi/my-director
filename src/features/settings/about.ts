import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';

import type { AboutInfo } from './settings-rows';

const UNKNOWN = '?';

export const ABOUT: AboutInfo = {
  app: Application.applicationName ?? UNKNOWN,
  version: Application.nativeApplicationVersion ?? UNKNOWN,
  build: Application.nativeBuildVersion ?? UNKNOWN,
  debug: __DEV__,
  device: Device.modelName ?? UNKNOWN,
  os: `${Device.osName ?? UNKNOWN} ${Device.osVersion ?? UNKNOWN}`,
  runtime: Updates.runtimeVersion,
  update: {
    enabled: Updates.isEnabled,
    embedded: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId,
    channel: Updates.channel || null,
  },
};
