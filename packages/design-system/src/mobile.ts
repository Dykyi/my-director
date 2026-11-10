import { fontFace, themeColors, type DesignTokens } from './tokens.ts';

const GENERATED = 'Written by `yarn tokens` from packages/design-system/tokens.json. Do not edit.';

const pixels = (value: string) => Number.parseFloat(value);

// Colours change with the theme, so Uniwind variants; radii do not, so @theme.
export function renderThemeCss(tokens: DesignTokens): string {
  const variants = Object.entries(themeColors(tokens)).flatMap(([theme, colors]) => [
    `    @variant ${theme} {`,
    ...Object.entries(colors).map(([name, value]) => `      --color-${name}: ${value};`),
    '    }',
  ]);
  return [
    `/* ${GENERATED} */`,
    '@layer theme {',
    '  :root {',
    ...variants,
    '  }',
    '}',
    '',
    '@theme {',
    ...tokens.radius.tokens.map(({ name, value }) => `  --${name}: ${value};`),
    '}',
    '',
  ].join('\n');
}

// For what className cannot reach: the native window and the participant avatars.
export function renderThemeColors(tokens: DesignTokens): string {
  const themes = Object.entries(themeColors(tokens)).flatMap(([theme, colors]) => [
    `  ${theme}: {`,
    ...Object.entries(colors).map(([name, value]) => `    '${name}': '${value}',`),
    '  },',
  ]);
  return [
    `// ${GENERATED}`,
    'export const THEME_COLORS = {',
    ...themes,
    '} as const;',
    '',
    'export type ThemeName = keyof typeof THEME_COLORS;',
    'export type ColorRole = keyof (typeof THEME_COLORS)[ThemeName];',
    '',
  ].join('\n');
}

// The colour comes from className, so a style holds only the face, size and line height.
export function renderTypeStyles({ type }: DesignTokens): string {
  const appGroups = type.groups.filter(({ platform }) => platform !== 'web');
  const styles = appGroups.flatMap(({ family, styles: groupStyles }) =>
    groupStyles.map(({ name, fontSize, lineHeight, fontWeight, letterSpacing }) => {
      const props = [
        `fontFamily: '${fontFace(family, fontWeight)}'`,
        `fontSize: ${pixels(fontSize)}`,
        `lineHeight: ${pixels(lineHeight)}`,
      ];
      if (letterSpacing) props.push(`letterSpacing: ${pixels(letterSpacing)}`);
      return `  '${name}': { ${props.join(', ')} },`;
    }),
  );
  return [
    `// ${GENERATED}`,
    "import type { TextStyle } from 'react-native';",
    '',
    'export const TYPE_STYLES = {',
    ...styles,
    '} as const satisfies Record<string, TextStyle>;',
    '',
    'export type TypeStyle = keyof typeof TYPE_STYLES;',
    '',
  ].join('\n');
}
