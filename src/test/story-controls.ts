import { THEME_COLORS, type ColorRole } from '@theme/colors';
import { ICONS } from '@ui/icons';

export const selectOf = <T extends string>(members: Record<T, unknown>) => ({
  control: { type: 'select' as const },
  options: Object.keys(members) as T[],
});

export const iconControl = selectOf(ICONS);

export const tintControl = {
  control: { type: 'select' as const },
  options: (Object.keys(THEME_COLORS.dark) as ColorRole[]).map((role) => `accent-${role}`),
};

export const rangeOf = (min: number, max: number, step = 1) => ({
  control: { type: 'range' as const, min, max, step },
});
