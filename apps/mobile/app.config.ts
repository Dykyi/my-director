// Lets Node load the TypeScript config plugins in ./plugins.
import 'tsx/cjs';

import type { ConfigContext, ExpoConfig } from 'expo/config';

import { THEME_COLORS } from './src/theme/colors';

// JS does not know the stored theme at launch, so the window and splash stay dark and never flash white.
const LAUNCH_BACKGROUND = THEME_COLORS.dark.background;
const EAS_PROJECT_ID = '51785edd-a492-4a9d-aeca-aac00539e375';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MyDirector',
  slug: 'mydirector',
  version: '0.1.0',
  owner: 'dikiy',
  runtimeVersion: { policy: 'fingerprint' },
  // Fetched on launch and applied on the next one, so an update never restarts the app mid-recording.
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
    // EAS Build writes the profile's channel itself; a build archived in Xcode takes this one.
    requestHeaders: { 'expo-channel-name': 'production' },
  },
  extra: { ...config.extra, eas: { projectId: EAS_PROJECT_ID } },
  scheme: 'com.dikiy.mydirector',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  backgroundColor: LAUNCH_BACKGROUND,
  icon: './assets/icon.png',
  ios: {
    appleTeamId: process.env.APPLE_TEAM_ID,
    bundleIdentifier: 'com.dikiy.mydirector',
    buildNumber: '3',
    icon: {
      light: './assets/icon.png',
      dark: './assets/ios-dark.png',
      tinted: './assets/ios-tinted.png',
    },
    supportsTablet: false,
    deploymentTarget: '17.0',
    // Export compliance: only standard encryption (HTTPS, WebRTC's DTLS-SRTP), so TestFlight never stops to ask.
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSCameraUsageDescription:
        'MyDirector films your interview on this iPhone in full quality and shows you to the interviewer during the call.',
      NSMicrophoneUsageDescription:
        'MyDirector records your answers on this iPhone and lets the interviewer hear you during the call.',
      NSPhotoLibraryAddUsageDescription:
        'MyDirector saves a recording to Photos when you choose Save Video.',
      UIBackgroundModes: ['audio'],
      UIFileSharingEnabled: true,
      LSSupportsOpeningDocumentsInPlace: true,
    },
  },
  android: {
    package: 'com.dikiy.mydirector',
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
