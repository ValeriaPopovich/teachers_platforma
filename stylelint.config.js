export default {
  extends: ['stylelint-config-standard-scss'],
  ignoreFiles: ['**/node_modules/**', '**/coverage/**', '**/test-results/**'],
  rules: {
    'color-function-notation': 'legacy',
    'declaration-block-no-redundant-longhand-properties': null,
    'no-descending-specificity': null,
    'property-no-vendor-prefix': null,
    'selector-class-pattern': null,
    'selector-id-pattern': null,
    'selector-not-notation': null,
    'value-keyword-case': ['lower', { camelCaseSvgKeywords: true }],
  },
};
