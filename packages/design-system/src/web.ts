import { fontFaces, themeColors, type DesignTokens } from './tokens.ts';

// A dot is not allowed in a custom property name.
const propertyName = (token: string) => token.replace('.', '_');

function fontFaceRules(tokens: DesignTokens): string[] {
  return fontFaces(tokens).flatMap(({ face, family, weight }) => [
    '@font-face {',
    `  font-family: '${family}';`,
    `  font-weight: ${weight};`,
    '  font-display: swap;',
    `  src: url('fonts/${face}.ttf') format('truetype');`,
    '}',
  ]);
}

function typeProperties({ type }: DesignTokens): string[] {
  return [
    ...Object.entries(type.families).map(([family, stack]) => `  --font-${family}: ${stack};`),
    ...type.groups.flatMap(({ family, styles }) =>
      styles.flatMap(({ name, fontSize, lineHeight, fontWeight, letterSpacing }) => [
        `  --text-${name}: ${fontWeight} ${fontSize}/${lineHeight} var(--font-${family});`,
        ...(letterSpacing ? [`  --tracking-${name}: ${letterSpacing};`] : []),
      ]),
    ),
  ];
}

export function renderWebCss(tokens: DesignTokens, theme: string): string {
  const colors = themeColors(tokens)[theme];
  if (!colors) throw new Error(`The tokens have no ${theme} theme`);
  return [
    ...fontFaceRules(tokens),
    ':root {',
    `  color-scheme: ${theme};`,
    ...Object.entries(colors).map(([name, value]) => `  --color-${name}: ${value};`),
    ...tokens.radius.tokens.map(({ name, value }) => `  --${name}: ${value};`),
    ...tokens.spacing.tokens.map(({ name, value }) => `  --${propertyName(name)}: ${value};`),
    ...typeProperties(tokens),
    '}',
    '',
  ].join('\n');
}
