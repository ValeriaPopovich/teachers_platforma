import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';

export default [
  { ignores: ['node_modules/**', 'coverage/**', 'dist/**'] },
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
