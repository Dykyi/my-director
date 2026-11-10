import { useUniwind } from 'uniwind';

import { THEME_COLORS, type ThemeName } from './colors';
import { PARTICIPANT_COLORS, type ParticipantColors } from './scales';

export function useThemeName(): ThemeName {
  const { theme } = useUniwind();
  return theme === 'light' ? 'light' : 'dark';
}

export function useThemeColors() {
  return THEME_COLORS[useThemeName()];
}

export function useParticipantColors(index: number): ParticipantColors {
  const scale = PARTICIPANT_COLORS[useThemeName()];
  return scale[index % scale.length] ?? scale[0];
}
