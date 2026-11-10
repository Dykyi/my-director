import { storedPreference } from '@shared/stored-preference';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

const DEFAULT_THEME: ThemePreference = 'system';

export const appearance = storedPreference('preferences.theme', THEME_PREFERENCES);

export const useAppearance = (): ThemePreference => appearance.use() ?? DEFAULT_THEME;
