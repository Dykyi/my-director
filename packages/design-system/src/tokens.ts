import json from '../tokens.json' with { type: 'json' };

type ColorValue = string | Record<string, string>;
export type TypeToken = {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
};
type SizeToken = { name: string; value: string };

export type DesignTokens = {
  color: { themes: { id: string }[]; tokens: { name: string; value: ColorValue }[] };
  radius: { tokens: SizeToken[] };
  spacing: { tokens: SizeToken[] };
  type: {
    families: Record<string, string>;
    groups: { family: string; platform?: string; styles: TypeToken[] }[];
  };
};

export const TOKENS: DesignTokens = json;

const ALIAS = /^\{(.+)\}$/;
// Static font files carry the weight in the face name.
const FACE_PREFIX: Record<string, string> = { sans: 'Inter', mono: 'JetBrainsMono' };
const WEIGHT_SUFFIX: Record<number, string> = {
  400: '400Regular',
  500: '500Medium',
  600: '600SemiBold',
  700: '700Bold',
};

export function themeColors({ color }: DesignTokens): Record<string, Record<string, string>> {
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

export type FontFace = { face: string; family: string; weight: number };

const familyName = (stack: string) => (stack.split(',')[0] ?? '').trim().replaceAll("'", '');

export function fontFaces({ type }: DesignTokens): FontFace[] {
  const faces = new Map<string, FontFace>();
  for (const { family, styles } of type.groups) {
    for (const { fontWeight } of styles) {
      const face = fontFace(family, fontWeight);
      faces.set(face, {
        face,
        family: familyName(type.families[family] ?? ''),
        weight: fontWeight,
      });
    }
  }
  return [...faces.values()];
}

export function fontFace(family: string, weight: number): string {
  const prefix = FACE_PREFIX[family];
  const suffix = WEIGHT_SUFFIX[weight];
  if (!prefix || !suffix) {
    throw new Error(`No font face for ${family} ${weight}: add it to tokens.ts and fonts.ts`);
  }
  return `${prefix}_${suffix}`;
}
