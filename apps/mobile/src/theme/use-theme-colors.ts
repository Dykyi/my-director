import { useUniwind } from 'uniwind';

import { THEME_COLORS, type ThemeName } from './colors';
import { PARTICIPANT_COLORS, type ParticipantColors } from './scales';

/** Re-renders on a change, unlike reading `Uniwind.currentTheme`. */
export function useThemeName(): ThemeName {
  const { theme } = useUniwind();
  return theme === 'light' ? 'light' : 'dark';
}

/** Colours for props className cannot reach, such as the native window behind the React tree. */
export function useThemeColors() {
  return THEME_COLORS[useThemeName()];
}

export function useParticipantColors(index: number): ParticipantColors {
  const scale = PARTICIPANT_COLORS[useThemeName()];
  return scale[index % scale.length] ?? scale[0];
}
