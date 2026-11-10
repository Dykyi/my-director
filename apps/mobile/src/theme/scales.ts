import { THEME_COLORS, type ThemeName } from './colors';

export type ParticipantColors = { text: string; ground: string };

const accentPair = (theme: ThemeName): ParticipantColors => ({
  text: THEME_COLORS[theme].accent,
  ground: THEME_COLORS[theme]['accent-soft'],
});

export const PARTICIPANT_COLORS: Record<
  ThemeName,
  readonly [ParticipantColors, ...ParticipantColors[]]
> = {
  dark: [accentPair('dark'), { text: '#c9b6ff', ground: '#2a2140' }],
  light: [accentPair('light'), { text: '#5a3ea6', ground: '#e2daf5' }],
};
