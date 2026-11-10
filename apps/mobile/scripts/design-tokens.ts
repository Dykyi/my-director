import { readFileSync, writeFileSync } from 'node:fs';

import {
  renderThemeColors,
  renderThemeCss,
  renderTypeStyles,
  type DesignTokens,
} from '@theme/render-tokens';

const tokens = JSON.parse(readFileSync('../../design/tokens.json', 'utf8')) as DesignTokens;
writeFileSync('src/theme/theme.css', renderThemeCss(tokens));
writeFileSync('src/theme/colors.ts', renderThemeColors(tokens));
writeFileSync('src/theme/type-styles.ts', renderTypeStyles(tokens));
console.log('Updated src/theme/theme.css, colors.ts and type-styles.ts');
