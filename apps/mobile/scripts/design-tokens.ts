import { writeFileSync } from 'node:fs';
import {
  renderThemeColors,
  renderThemeCss,
  renderTypeStyles,
  TOKENS,
} from '@mydirector/design-system';

const THEME_FILES = {
  'src/theme/theme.css': renderThemeCss,
  'src/theme/colors.ts': renderThemeColors,
  'src/theme/type-styles.ts': renderTypeStyles,
};

for (const [file, render] of Object.entries(THEME_FILES)) writeFileSync(file, render(TOKENS));
console.log(`Updated ${Object.keys(THEME_FILES).join(', ')}`);
