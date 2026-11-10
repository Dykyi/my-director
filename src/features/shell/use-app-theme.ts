import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Uniwind } from 'uniwind';

import { useAppearance } from '@theme/appearance';
import { useThemeColors } from '@theme/use-theme-colors';

export function useAppTheme() {
  const preference = useAppearance();
  const { background } = useThemeColors();
  useEffect(() => {
    Uniwind.setTheme(preference);
  }, [preference]);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(background);
  }, [background]);
}
