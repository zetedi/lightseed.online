import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';

// The security fence around the release's hottest rules. Runs under the Firestore emulator:
//   npm run test:rules
// Each test asks one question: can THIS person do THIS thing — and only that thing?

let env: RulesTestEnvironment;

const ALICE = 'alice-uid';   // initiator / community founder
const BOB = 'bob-uid';       // target / tree owner
const MALLORY = 'mallory-uid';
const STAFF = 'staff-uid';

const db = (uid?: string) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());

// Seed data written with rules disabled (as the backend would).
const seed = async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'admins', STAFF), { grantedAt: 1 });
    await setDoc(doc(d, 'alignments', 'al1'), {
      initiatorUid: ALICE, targetUid: BOB,
      initiatorTreeId: 'treeA', targetTreeId: 'treeB',
      initiatorPulseId: 'p1', targetPulseId: 'p2',
      status: 'PENDING', messages: [],
    });
    await setDoc(doc(d, 'lifetrees', 'treeB'), { ownerId: BOB, name: 'Bobs tree', validated: false, validatorId: null });
    await setDoc(doc(d, 'initiates', ALICE), { handle: 'alice', name: 'Alice', lid: 'x', pubkey: 'y', initiatedAt: '2026-07-07' });
    await setDoc(doc(d, 'communities', 'com1'), { ownerId: ALICE, name: 'Com', domain: 'com.online' });
  });
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'lifeseed-rules-test',
    firestore: { rules: readFileSync(join(__dirname, '..', '..', 'firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(); });

describe("alignments — the discussion is open, the settlement is the target's", () => {
  it('either participant may write messages while PENDING', async () => {
    await assertSucceeds(updateDoc(doc(db(ALICE), 'alignments', 'al1'), { messages: [{ by: ALICE, text: 'hi', at: 1 }] }));
    await assertSucceeds(updateDoc(doc(db(BOB), 'alignments', 'al1'), { messages: [{ by: BOB, text: 'hello', at: 2 }] }));
  });

  it('a non-participant may not write messages', async () => {
    await assertFails(updateDoc(doc(db(MALLORY), 'alignments', 'al1'), { messages: [{ by: MALLORY, text: 'let me in', at: 3 }] }));
  });

  it('the INITIATOR cannot self-accept — only the target settles status', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'alignments', 'al1'), { status: 'ACCEPTED' }));
    await assertSucceeds(updateDoc(doc(db(BOB), 'alignments', 'al1'), { status: 'ACCEPTED' }));
  });

  it('status and messages cannot ride along with other fields', async () => {
    await assertFails(updateDoc(doc(db(BOB), 'alignments', 'al1'), { status: 'ACCEPTED', targetPulseId: 'forged' }));
    await assertFails(updateDoc(doc(db(ALICE), 'alignments', 'al1'), { messages: [], initiatorTreeId: 'forged' }));
  });
});

describe('initiates — git is the source of truth; only staff mirror it', () => {
  it('anyone may read; a non-staff user may not write themselves in', async () => {
    await assertSucceeds(getDoc(doc(db(), 'initiates', ALICE)));
    await assertFails(setDoc(doc(db(MALLORY), 'initiates', MALLORY), { handle: 'mallory' }));
    await assertSucceeds(setDoc(doc(db(STAFF), 'initiates', BOB), { handle: 'bob' }));
  });
});

describe('lifetrees validation — initiates sign in their own name, on only', () => {
  it('an initiate validates a tree (validation fields only, validatorId = self)', async () => {
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lifetrees', 'treeB'), {
      validated: true, validatorId: ALICE, updatedAt: 1,
    }));
  });

  it('a non-initiate without a validated tree cannot validate', async () => {
    await assertFails(updateDoc(doc(db(MALLORY), 'lifetrees', 'treeB'), {
      validated: true, validatorId: MALLORY, updatedAt: 1,
    }));
  });

  it('an initiate cannot name someone else as validator, un-validate, or smuggle other fields', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'treeB'), { validated: true, validatorId: BOB, updatedAt: 1 }));
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'treeB'), { validated: false, validatorId: ALICE, updatedAt: 1 }));
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'treeB'), { validated: true, validatorId: ALICE, ownerId: ALICE, updatedAt: 1 }));
  });
});

describe('communityTreeInvites — anyone invites as themselves; the tree owner settles', () => {
  const invite = { communityId: 'com1', communityName: 'Com', lifetreeId: 'treeB', lifetreeName: 'Bobs tree', invitedUserId: BOB, invitedByUserId: ALICE, status: 'pending' };

  it('creating requires naming yourself as inviter', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'communityTreeInvites', 'inv1'), invite));
    await assertFails(setDoc(doc(db(MALLORY), 'communityTreeInvites', 'inv2'), invite)); // forged inviter
  });

  it('the invitee settles; a stranger cannot', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'communityTreeInvites', 'inv1'), invite));
    await assertSucceeds(updateDoc(doc(db(BOB), 'communityTreeInvites', 'inv1'), { status: 'accepted', respondedAt: 1 }));
    await assertFails(updateDoc(doc(db(MALLORY), 'communityTreeInvites', 'inv1'), { status: 'accepted' }));
  });

  it("accepting mints the participant link — only the tree's owner may", async () => {
    const link = { lid: 'x', type: 'link', rel: 'participant', from: 'treeB', to: 'com1', createdAt: 1 };
    await assertSucceeds(setDoc(doc(db(BOB), 'links', 'treeB__participant__com1'), link));
    await assertFails(setDoc(doc(db(MALLORY), 'links', 'treeB__participant__com1'), link));
  });
});

describe('collabs — staff-curated, world-readable', () => {
  it('anyone reads, only staff write', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'collabs', 'c1'), { name: 'Anthropic', agreement: 'contract' }));
    await assertSucceeds(getDoc(doc(db(), 'collabs', 'c1')));
    await assertFails(setDoc(doc(db(MALLORY), 'collabs', 'c2'), { name: 'EvilCorp', agreement: 'founder' }));
    await assertSucceeds(setDoc(doc(db(STAFF), 'collabs', 'c3'), { name: 'GoodOrg', agreement: 'founder' }));
    await assertFails(deleteDoc(doc(db(MALLORY), 'collabs', 'c1')));
  });
});
