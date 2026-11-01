import { defineConfig } from 'vitest/config';

// Firestore and Storage security-rules tests — run ONLY under the emulators:
//   npm run test:rules      (wraps: firebase emulators:exec --only firestore,storage "vitest run --config …")
// Separate config so `npm test` stays instant and emulator-free.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.rules-test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
