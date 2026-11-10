import 'tsx/cjs';

import type { ConfigContext, ExpoConfig } from 'expo/config';

import { THEME_COLORS } from './src/theme/colors';

const LAUNCH_BACKGROUND = THEME_COLORS.dark.background;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MyDirector',
  slug: 'mydirector-capture-poc',
  version: '0.1.0',
  runtimeVersion: { policy: 'fingerprint' },
  scheme: 'com.dykyi.mydirector.capturepoc',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  backgroundColor: LAUNCH_BACKGROUND,
  icon: './assets/icon.png',
  ios: {
    appleTeamId: process.env.APPLE_TEAM_ID,
    bundleIdentifier: 'com.dykyi.mydirector.capturepoc',
    icon: {
      light: './assets/icon.png',
      dark: './assets/ios-dark.png',
      tinted: './assets/ios-tinted.png',
    },
    supportsTablet: false,
    deploymentTarget: '17.0',
    infoPlist: {
      NSCameraUsageDescription:
        'The camera records your interview and shows you to the interviewer.',
      NSMicrophoneUsageDescription:
        'The microphone records your answers and lets the interviewer hear you.',
      UIBackgroundModes: ['audio'],
      UIFileSharingEnabled: true,
      LSSupportsOpeningDocumentsInPlace: true,
    },
  },
  android: {
    package: 'com.dykyi.mydirector.capturepoc',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 160, backgroundColor: LAUNCH_BACKGROUND },
    ],
    ['expo-build-properties', { ios: { enableSceneSupport: true } }],
    './plugins/with-livekit-podspecs.ts',
  ],
});
