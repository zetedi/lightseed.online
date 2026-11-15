import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { FACES_STILL_CALLING_BACKEND } from './eslint.faces-ratchet.mjs';

// The lint fence: TypeScript (strict) catches type holes; this catches what types can't —
// hook-dependency bugs (stale closures), conditional hooks, and foot-guns. `npm run lint`.
// exhaustive-deps is a warning (the codebase deliberately omits deps in places — each one
// should be a conscious eslint-disable, burned down over time); rules-of-hooks is an ERROR.
export default tseslint.config(
  { ignores: ['seed/generated', 'seed/web-dist', 'dist', 'dist-independent', 'dist-faces', 'dev-dist', 'node_modules', 'functions', 'scripts', 'public', 'tailwind.config.js'] },
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
  // THE LAYERS (root/ARCHITECTURE.md → Layers). The direction is law, not habit:
  //   domain/ imports nothing outside itself — no backend, no React, no service.
  {
    files: ['src/domain/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { regex: '^(@backend|firebase|react|react-dom)(/|$)', message: 'domain/ is pure: no backend, no React.' },
        { regex: '^(\\.\\./)+(services|adapters|hooks|components|pages|contexts|utils|config)(/|$)', message: 'domain/ imports nothing outside src/domain.' },
      ] }],
    },
  },
  //   a Firebase package is named only by the Firebase backend (and its two declared doors).
  {
    files: ['src/**'],
    ignores: ['src/services/firebase/**', 'src/adapters/firestore.ts', 'src/sso.ts', 'src/domain/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { regex: '^firebase(/|$)', message: 'Only src/services/firebase may import a Firebase package; everything else speaks to @backend.' },
      ] }],
    },
  },
  //   a face reaches the backend through a hook (hooks/use*), not by its own hand. Types may be
  //   imported freely. The faces listed in eslint.faces-ratchet.mjs still call @backend themselves:
  //   the list is a RATCHET — it only shrinks. Move a face's calls into a hook, then remove its line.
  {
    files: ['src/components/**', 'src/pages/**'],
    ignores: FACES_STILL_CALLING_BACKEND,
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [
        { regex: '^@backend(/|$)', allowTypeImports: true, message: 'A face reaches the backend through a hook (src/hooks). See eslint.faces-ratchet.mjs.' },
        { regex: '^firebase(/|$)', message: 'Only src/services/firebase may import a Firebase package.' },
      ] }],
      'no-restricted-imports': 'off',
    },
  },
);
