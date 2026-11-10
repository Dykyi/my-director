const path = require('node:path');
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  {
    settings: {
      'import/resolver': { typescript: { project: path.join(__dirname, 'tsconfig.json') } },
    },
  },
  {
    ignores: ['dist/*', 'tools/**'],
  },
  {
    files: ['.rnstorybook/storybook.requires.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettierConfig,
]);
