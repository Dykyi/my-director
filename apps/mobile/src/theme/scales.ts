import { THEME_COLORS, type ColorRole, type ThemeName } from './colors';

export type ParticipantColors = { text: string; ground: string };

const pair = (theme: ThemeName, text: ColorRole, ground: ColorRole): ParticipantColors => ({
  text: THEME_COLORS[theme][text],
  ground: THEME_COLORS[theme][ground],
});

export const PARTICIPANT_COLORS: Record<
  ThemeName,
  readonly [ParticipantColors, ...ParticipantColors[]]
> = {
  dark: [pair('dark', 'accent', 'accent-soft'), pair('dark', 'participant', 'participant-soft')],
  light: [pair('light', 'accent', 'accent-soft'), pair('light', 'participant', 'participant-soft')],
};
