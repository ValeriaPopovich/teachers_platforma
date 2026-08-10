export default {
  forbidden: [
    {
      name: 'shared-cannot-depend-on-features',
      severity: 'error',
      from: { path: '^src/(shared|state|utils)/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'views-cannot-import-supabase',
      severity: 'error',
      from: { path: '\\.view\\.(?:js|mjs)$' },
      to: { path: 'supabase|cloud' },
    },
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: '(^|/)(bootstrap|index|custom-select|.*\\.test)\\.(?:js|mjs)$',
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|coverage|test-results)/' },
    tsPreCompilationDeps: false,
  },
};
