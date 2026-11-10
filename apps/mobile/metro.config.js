const path = require('node:path');

const { withStorybook } = require('@storybook/react-native/metro/withStorybook');
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);
const { transformer, resolver } = config;

// Metro watches the whole monorepo; these folders hold no app code and are slow to crawl.
const MONOREPO_ROOT = path.resolve(__dirname, '../..');
const NOT_FOR_THE_BUNDLE = [
  'tools/verify/.venv',
  'services/upload-api/.wrangler',
  'apps/interviewer/.speech-cache',
  'pulled',
];
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// SVG files are imported as React components (react-native-svg-transformer), not as assets.
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
  blockList: [
    ...[resolver.blockList ?? []].flat(),
    ...NOT_FOR_THE_BUNDLE.map(
      (dir) => new RegExp(`^${escapeRegExp(path.join(MONOREPO_ROOT, dir))}/.*`),
    ),
  ],
};

// Uniwind swaps the transform worker and keeps the SVG Babel transformer.
const uniwindConfig = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
});

// Storybook reports usage from Metro unless this is set.
process.env.STORYBOOK_DISABLE_TELEMETRY ??= 'true';

// Storybook goes on top of Uniwind and only into development bundles; a production export leaves it out.
module.exports = withStorybook(uniwindConfig, { enabled: process.env.NODE_ENV !== 'production' });
