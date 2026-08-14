import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';

export default [
  { ignores: ['node_modules/**', 'coverage/**', 'dist/**', '.claude/**'] },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {},
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^vue$', '^@?\\w'],
            ['^@ui(?:/.*)?$', '^@icons(?:/.*)?$', '^@use(?:/.*)?$', '^@styles(?:/.*)?$'],
            ['^@modules(?:/.*)?$', '^@domain(?:/.*)?$', '^@state(?:/.*)?$'],
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            ['^.+\\.(?:css|scss)$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
      'vue/block-order': [
        'error',
        {
          order: ['script[setup]', 'script[src]', 'template', 'style'],
        },
      ],
      'vue/custom-event-name-casing': [
        'error',
        'kebab-case',
        { ignores: ['/^[a-z]+(?:-[a-z]+)*:[a-zA-Z]+$/u'] },
      ],
      'vue/v-on-event-hyphenation': ['error', 'always', { autofix: true }],
    },
  },
  {
    files: ['**/index.vue'],
    rules: {
      // Component name is declared in the external scripts/index.js file.
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: ['packages/**/*.js', 'src/**/components/**/*.js'],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  {
    // Browser entry points are ES modules. The remaining UI file is intentionally
    // migrated incrementally, so unused legacy helpers are not a release blocker.
    files: ['assets/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.browser,
        html2canvas: 'readonly',
        supabase: 'readonly',
        tutorCloud: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-empty': 'off',
    },
  },
  prettier,
];
