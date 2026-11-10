import { writeFileSync } from 'node:fs';
import {
  renderThemeColors,
  renderThemeCss,
  renderTypeStyles,
  TOKENS,
} from '@mydirector/design-system';

writeFileSync('src/theme/theme.css', renderThemeCss(TOKENS));
writeFileSync('src/theme/colors.ts', renderThemeColors(TOKENS));
writeFileSync('src/theme/type-styles.ts', renderTypeStyles(TOKENS));
console.log('Updated src/theme/theme.css, colors.ts and type-styles.ts');
