import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'coverage/**'] },
  js.configs.recommended,
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
    // Legacy inline-код, вынесенный на Этапе 2 без изменений. Строгий lint будет
    // включаться по мере переноса кусков в src/domain/ на Этапах 3–4.
    files: ['assets/**/*.js'],
    languageOptions: {
      sourceType: 'script',
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
];
