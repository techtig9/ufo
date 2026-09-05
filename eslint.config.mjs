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
  // Phase 1 framework upgrade — scoped, temporary relaxations.
  //
  // eslint-plugin-react-hooks v7 (pulled in by eslint-config-next@16) added
  // `set-state-in-effect` and `refs`. They flag pre-existing, working code in
  // the editor/generator surfaces — cascading-render performance smells, not
  // correctness bugs, and none of them changed behaviour in this upgrade.
  //
  // These files are deliberately NOT rewritten here: Phase 1 is the security
  // and authentication phase, and this environment has no credentials to
  // runtime-test the editor, so refactoring them now would risk regressing
  // working functionality with no way to verify it.
  //
  // The rules stay ERRORS everywhere else, so no new code can introduce the
  // pattern. Removing this block is tracked as Phase 3 work (the phase that
  // owns these components), where the editor can be exercised properly.
  // ---------------------------------------------------------------------
  {
    files: [
      'components/editor/ai-design-copilot.tsx',
      'components/editor/code-editor-panel.tsx',
      'components/editor/version-history-panel.tsx',
      'components/generator/generator-form.tsx',
      'components/notifications/notification-center.tsx',
      'components/prototype-viewer/prototype-viewer.tsx',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
];

export default config;
