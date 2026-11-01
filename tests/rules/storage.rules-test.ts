import { describe, it, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

// THE PLANS (ring 2026-10-27) — storage.rules opens every picture to everyone but one shelf:
// plans/{face}/…, readable only with a signed-in token. The public read is carved by the
// path's first segment, so these tests also prove the carve-out did not close the rest —
// including a file at the bucket's root, where the first segment is the whole name.

let env: RulesTestEnvironment;

const BEING = 'being-uid';
const PLAN = 'plans/theohouse/layout-b-84.glb';
const DEEP_PLAN = 'plans/theohouse/older/layout-b-25.glb';
const PICTURE = 'beings/some-lid/portrait.webp';
const NESTED_PICTURE = 'communities/some-id/plans/hero.webp'; // a "plans" folder elsewhere stays open
const ROOT_PICTURE = 'plans.webp'; // beside the shelf, not on it

const storage = (uid?: string) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).storage();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'lifeseed-storage-test',
    storage: { rules: readFileSync(join(__dirname, '..', '..', 'storage.rules'), 'utf8') },
  });
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const path of [PLAN, DEEP_PLAN, PICTURE, NESTED_PICTURE, ROOT_PICTURE]) {
      await ctx.storage().ref(path).put(new Uint8Array([1, 2, 3]));
    }
  });
});
afterAll(async () => { await env.cleanup(); });

describe('storage reads', () => {
  it('every picture stays open to everyone', async () => {
    await assertSucceeds(storage().ref(PICTURE).getMetadata());
    await assertSucceeds(storage().ref(NESTED_PICTURE).getMetadata());
    await assertSucceeds(storage().ref(ROOT_PICTURE).getMetadata());
  });

  it('the plans refuse an anonymous read, at any depth, and an anonymous listing', async () => {
    await assertFails(storage().ref(PLAN).getMetadata());
    await assertFails(storage().ref(DEEP_PLAN).getMetadata());
    await assertFails(storage().ref('plans/theohouse').listAll());
  });

  it('the plans open to a signed-in being', async () => {
    await assertSucceeds(storage(BEING).ref(PLAN).getMetadata());
    await assertSucceeds(storage(BEING).ref(DEEP_PLAN).getMetadata());
  });

  it("signing in reads the plans, it does not write them", async () => {
    await assertFails(storage(BEING).ref(PLAN).put(new Uint8Array([4])).then());
  });
});
