import { defineConfig } from 'vitest/config';

// The living suites — the Grove (parallel living-path simulation through the REAL rules,
// REAL callables and REAL triggers) and the Crossing (export → restore → verify between two
// emulator databases). Run ONLY under the full emulator set, in a demo- project (offline by
// construction):
//   npm run test:living
// Sequential on purpose: triggers fire on one shared project namespace, so determinism
// beats parallelism here (the PARALLELISM under test is inside the journeys, not between
// test files). Kept out of `npm run check` like test:rules — emulator startup is seconds,
// check stays instant.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/living/**/*.living-test.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
