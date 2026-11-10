import * as Application from 'expo-application';
import * as Device from 'expo-device';

import type { AboutInfo } from './settings-rows';

const UNKNOWN = '?';

export const ABOUT: AboutInfo = {
  app: Application.applicationName ?? UNKNOWN,
  version: Application.nativeApplicationVersion ?? UNKNOWN,
  build: Application.nativeBuildVersion ?? UNKNOWN,
  debug: __DEV__,
  device: Device.modelName ?? UNKNOWN,
};
