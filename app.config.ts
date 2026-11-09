import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  ios: { ...config.ios, appleTeamId: process.env.APPLE_TEAM_ID },
});
