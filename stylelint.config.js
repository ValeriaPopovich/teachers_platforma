export default {
  extends: ['stylelint-config-standard-scss', 'stylelint-config-recommended-vue/scss'],
  plugins: ['stylelint-order'],
  ignoreFiles: ['**/node_modules/**', '**/coverage/**', '**/test-results/**'],
  rules: {
    'at-rule-empty-line-before': null,
    'color-function-notation': 'legacy',
    'declaration-block-no-redundant-longhand-properties': null,
    'declaration-empty-line-before': null,
    'no-descending-specificity': null,
    'no-empty-source': null,
    'property-no-vendor-prefix': null,
    'scss/dollar-variable-empty-line-before': null,
    'scss/no-global-function-names': null,
    'selector-class-pattern': null,
    'selector-max-id': 0,
    'selector-id-pattern': null,
    'selector-not-notation': null,
    'value-keyword-case': ['lower', { camelCaseSvgKeywords: true }],
  },
  overrides: [
    {
      files: ['styles/features/_board.scss'],
      rules: {
        'selector-max-id': null,
      },
    },
    {
      files: ['src/**/*.vue', 'packages/**/*.{vue,scss}'],
      rules: {
        'order/order': [
          'custom-properties',
          'dollar-variables',
          'declarations',
          'at-rules',
          'rules',
        ],
      },
    },
  ],
};
