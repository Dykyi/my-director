type ColorValue = string | Record<string, string>;
type TypeToken = {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
};

export type DesignTokens = {
  color: { themes: { id: string }[]; tokens: { name: string; value: ColorValue }[] };
  radius: { tokens: { name: string; value: string }[] };
  type: { groups: { family: string; styles: TypeToken[] }[] };
};

const GENERATED = 'Written by `yarn tokens` from design/tokens.json. Do not edit.';
const ALIAS = /^\{(.+)\}$/;
const FACE_PREFIX: Record<string, string> = { sans: 'Inter', mono: 'JetBrainsMono' };
const WEIGHT_SUFFIX: Record<number, string> = {
  400: '400Regular',
  500: '500Medium',
  600: '600SemiBold',
  700: '700Bold',
};

const pixels = (value: string) => Number.parseFloat(value);

function themeColors({ color }: DesignTokens): Record<string, Record<string, string>> {
  const firstTheme = color.themes[0]?.id ?? '';
  const valueIn = (theme: string, value: ColorValue | undefined): string =>
    typeof value === 'string' ? value : (value?.[theme] ?? value?.[firstTheme] ?? '');
  const byName = new Map(color.tokens.map((token) => [token.name, token.value]));
  const resolve = (theme: string, value: string): string => {
    const alias = ALIAS.exec(value)?.[1];
    return alias === undefined ? value : resolve(theme, valueIn(theme, byName.get(alias)));
  };
  return Object.fromEntries(
    color.themes.map(({ id }) => [
      id,
      Object.fromEntries(
        color.tokens.map(({ name, value }) => [name, resolve(id, valueIn(id, value))]),
      ),
    ]),
  );
}

function fontFace(family: string, weight: number): string {
  const prefix = FACE_PREFIX[family];
  const suffix = WEIGHT_SUFFIX[weight];
  if (!prefix || !suffix) {
    throw new Error(
      `No font face for ${family} ${weight}: add it to render-tokens.ts and fonts.ts`,
    );
  }
  return `${prefix}_${suffix}`;
}

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

export function renderTypeStyles({ type }: DesignTokens): string {
  const styles = type.groups.flatMap(({ family, styles: groupStyles }) =>
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
