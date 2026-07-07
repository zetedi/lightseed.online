import { defineConfig } from 'vitest/config';

// Firestore security-rules tests — run ONLY under the emulator:
//   npm run test:rules      (wraps: firebase emulators:exec --only firestore "vitest run --config …")
// Separate config so `npm test` stays instant and emulator-free.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.rules-test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
