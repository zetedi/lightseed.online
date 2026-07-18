import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// The lint fence: TypeScript (strict) catches type holes; this catches what types can't —
// hook-dependency bugs (stale closures), conditional hooks, and foot-guns. `npm run lint`.
// exhaustive-deps is a warning (the codebase deliberately omits deps in places — each one
// should be a conscious eslint-disable, burned down over time); rules-of-hooks is an ERROR.
export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'functions', 'scripts', 'public', 'tailwind.config.js'] },
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Strict TS already guards types; these two fight the codebase's deliberate style.
      '@typescript-eslint/no-explicit-any': 'off',        // 278 known; a tracked burn-down, not noise
      '@typescript-eslint/no-unused-vars': 'off',         // tsc's noUnusedLocals owns this
      // ERRORS — structural correctness. Zero violations today; must stay zero.
      'react-hooks/rules-of-hooks': 'error',
      // WARNINGS — the tracked burn-down. The React-Compiler-era rules flag real (pre-compiler-
      // idiomatic) patterns: setState-in-effect data loading, components defined during render.
      // Fix opportunistically; don't let the count grow.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
);
