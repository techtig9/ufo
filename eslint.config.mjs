import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

/**
 * ESLint flat config.
 *
 * Next.js 16 removed the `next lint` command, so `npm run lint` now calls the
 * ESLint CLI directly. eslint-config-next@16 ships a native flat-config array,
 * so it can be spread straight in — no FlatCompat shim needed. This replaces
 * the old .eslintrc.json (`{ "extends": "next/core-web-vitals" }`), which the
 * ESLint 9 CLI no longer reads by default.
 */
const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },

  ...nextCoreWebVitals,

  // ---------------------------------------------------------------------
  // Playwright specs are not React.
  //
  // A fixture's second argument is conventionally named `use`, and
  // eslint-plugin-react-hooks reads any call to `use(...)` as React's `use`
  // hook — then reports it as a hook called outside a component. There is no
  // React in this directory at all, so the React rule sets are switched off
  // here rather than the call being renamed to something less idiomatic.
  // ---------------------------------------------------------------------
  {
    files: ['e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
    },
  },
];

export default config;
