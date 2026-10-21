import js from '@eslint/js';
import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

export default ts.config(
  { ignores: ['node_modules/**', 'dist/**', 'data/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/essential'],
  { files: ['**/*.{js,mjs,ts,vue}'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: ts.parser, extraFileExtensions: ['.vue'] } },
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
