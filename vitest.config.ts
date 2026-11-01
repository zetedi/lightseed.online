import { defineConfig } from 'vitest/config';

// Standalone test config (takes precedence over vite.config.ts, so the PWA/react plugins don't
// run during tests). Pure node environment — the fence guards domain logic, not components:
// the chain's canonical hashing, validation windows, ids, tones, the initiation ledger.
// Rules tests live in tests/rules/*.rules-test.ts and only run under the Firestore emulator
// (npm run test:rules) — the -test.ts suffix keeps them out of the default sweep.
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    // The backend seam resolves to the Firebase services here, as in the app's default build.
    alias: { '@backend': resolve('src/services/firebase') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
