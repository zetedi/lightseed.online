import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, deleteField, Timestamp } from 'firebase/firestore';

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
    await setDoc(doc(d, 'lightHouses', 'lh1'), { ownerId: ALICE, name: 'The Hearth', lid: 'lh1-lid' });
    await setDoc(doc(d, 'lifetrees', 'bedStay'), { ownerId: ALICE, name: 'Cedar', treeType: 'BED', lightHouseId: 'lh1', visibility: 'node', validated: false, validatorId: null });
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

describe('config/limits — the node planting caps: world-readable, staff-set', () => {
  it('anyone may read the caps; only staff may set them', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'config', 'limits'), { maxLifetrees: 12, maxGuardedTrees: 132 }));
    await assertSucceeds(getDoc(doc(db(), 'config', 'limits')));
    await assertFails(setDoc(doc(db(MALLORY), 'config', 'limits'), { maxLifetrees: 9999, maxGuardedTrees: 9999 }));
    await assertSucceeds(setDoc(doc(db(STAFF), 'config', 'limits'), { maxLifetrees: 21, maxGuardedTrees: 123 }));
  });

  it('other config docs stay staff-only (superadmin doc readable, not writable)', async () => {
    await assertFails(setDoc(doc(db(MALLORY), 'config', 'superadmin'), { uid: MALLORY }));
  });
});

describe('community joining — anyone knocks as themselves; only the keeper opens', () => {
  const joinReq = (from: string) => ({ lid: 'x', type: 'link', rel: 'join_request', from, to: 'com1', createdAt: 1 });
  const memberLink = { lid: 'x', type: 'link', rel: 'member', from: BOB, to: 'com1', createdAt: 1 };

  it('a signed-in user may ask to join — as themselves only', async () => {
    await assertSucceeds(setDoc(doc(db(BOB), 'links', `${BOB}__join_request__com1`), joinReq(BOB)));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${BOB}__join_request__com1`), joinReq(BOB))); // forged knocker
  });

  it('the member link is minted by the community owner — never by the requester or a stranger', async () => {
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__member__com1`), memberLink));     // self-admit
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${BOB}__member__com1`), memberLink)); // stranger
    await assertSucceeds(setDoc(doc(db(ALICE), 'links', `${BOB}__member__com1`), memberLink)); // keeper of com1
  });

  it('the keeper may decline a request and remove a member; a stranger may neither', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'links', `${BOB}__join_request__com1`), joinReq(BOB));
      await setDoc(doc(ctx.firestore(), 'links', `${BOB}__member__com1`), memberLink);
    });
    await assertFails(deleteDoc(doc(db(MALLORY), 'links', `${BOB}__join_request__com1`)));
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'links', `${BOB}__join_request__com1`)));
    await assertFails(deleteDoc(doc(db(MALLORY), 'links', `${BOB}__member__com1`)));
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'links', `${BOB}__member__com1`)));
  });

  it('the requester may withdraw their own knock', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'links', `${BOB}__join_request__com1`), joinReq(BOB)));
    await assertSucceeds(deleteDoc(doc(db(BOB), 'links', `${BOB}__join_request__com1`)));
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

describe('the lid is frozen — the true name is load-bearing (QR links stand on it)', () => {
  it('a tree owner may edit their tree but never its lid', async () => {
    await assertSucceeds(updateDoc(doc(db(BOB), 'lifetrees', 'treeB'), { name: 'Renamed' }));
    await assertFails(updateDoc(doc(db(BOB), 'lifetrees', 'treeB'), { lid: 'forged-lid' }));
  });
  it('a lightHouse keeper and a community keeper hit the same wall', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'lightHouses', 'sanc1'), { ownerId: ALICE, name: 'S', lid: 'true-name' });
    });
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lightHouses', 'sanc1'), { name: 'S2' }));
    await assertFails(updateDoc(doc(db(ALICE), 'lightHouses', 'sanc1'), { lid: 'forged' }));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'communities', 'com1'), { name: 'Com2' }));
    await assertFails(updateDoc(doc(db(ALICE), 'communities', 'com1'), { lid: 'forged' }));
  });
});

describe('guardian veto — window and tenure live in the rules, not only the client', () => {
  const mintPulse = async (createdAtMs: number, guardianSinceMs?: number) => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'pulses', 'mint1'), {
        type: 'tree_growth', lifetreeId: 'treeB', authorId: BOB,
        title: 'g', body: 'g', createdAt: Timestamp.fromMillis(createdAtMs), vetoes: [],
      });
      if (guardianSinceMs !== undefined) {
        await setDoc(doc(d, 'links', `${ALICE}__guardian__treeB`), {
          rel: 'guardian', from: ALICE, to: 'treeB', type: 'link',
          createdAt: Timestamp.fromMillis(guardianSinceMs),
        });
      }
    });
  };

  it('a tenured guardian vetoes a fresh mint', async () => {
    const now = Date.now();
    await mintPulse(now - 1000, now - 100000); // guardian stood before the mint
    await assertSucceeds(updateDoc(doc(db(ALICE), 'pulses', 'mint1'), { vetoes: [ALICE] }));
  });
  it('a guardian minted AFTER the pulse has no voice (the sock-account door)', async () => {
    const now = Date.now();
    await mintPulse(now - 100000, now - 1000); // guardian arrived after the mint
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', 'mint1'), { vetoes: [ALICE] }));
  });
  it('after 72 hours the mint is settled history', async () => {
    const now = Date.now();
    await mintPulse(now - 73 * 60 * 60 * 1000, now - 80 * 60 * 60 * 1000); // old mint, older guardian
    await assertFails(updateDoc(doc(db(ALICE), 'pulses', 'mint1'), { vetoes: [ALICE] }));
  });
  it('a non-guardian cannot veto at all', async () => {
    const now = Date.now();
    await mintPulse(now - 1000); // no guardian link
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', 'mint1'), { vetoes: [MALLORY] }));
  });
});

describe('the door — open lets beings in, closed closes ALL ways, keepers are delegated', () => {
  const SAM = 'sam-uid'; // steward of com1 — the delegated door-keeper
  const link = (from: string, rel: string, to: string, extra: object = {}) =>
    ({ lid: 'x', type: 'link', rel, from, to, ...extra, createdAt: 1 });

  // Door fixtures beside the seeded com1 (door absent = 'invite').
  const seedDoors = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'communities', 'open1'), { ownerId: ALICE, name: 'Open', domain: 'o', door: 'open' });
    await setDoc(doc(d, 'communities', 'closed1'), { ownerId: ALICE, name: 'Closed', domain: 'c', door: 'closed' });
    await setDoc(doc(d, 'links', `${SAM}__steward__com1`), link(SAM, 'steward', 'com1'));
  });

  it('open door: a signed-in being steps in themself; invite and closed doors refuse self-admission', async () => {
    await seedDoors();
    await assertSucceeds(setDoc(doc(db(BOB), 'links', `${BOB}__member__open1`), link(BOB, 'member', 'open1')));
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__member__com1`), link(BOB, 'member', 'com1')));
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__member__closed1`), link(BOB, 'member', 'closed1')));
  });

  it('closed door: even the knock is refused; the invite door still hears it', async () => {
    await seedDoors();
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__join_request__closed1`), link(BOB, 'join_request', 'closed1')));
    await assertSucceeds(setDoc(doc(db(BOB), 'links', `${BOB}__join_request__com1`), link(BOB, 'join_request', 'com1')));
  });

  it('a steward accepts a knock and tends the roster; a mere member cannot', async () => {
    await seedDoors();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'links', `${BOB}__join_request__com1`), link(BOB, 'join_request', 'com1'));
      await setDoc(doc(d, 'links', `${MALLORY}__member__com1`), link(MALLORY, 'member', 'com1'));
    });
    await assertSucceeds(setDoc(doc(db(SAM), 'links', `${BOB}__member__com1`), link(BOB, 'member', 'com1')));
    await assertSucceeds(deleteDoc(doc(db(SAM), 'links', `${BOB}__join_request__com1`)));
    await assertSucceeds(deleteDoc(doc(db(SAM), 'links', `${MALLORY}__member__com1`)));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${BOB}__member__com1`), link(BOB, 'member', 'com1')));
  });

  it('only the owner appoints stewards; a steward may step down; the owner may remove them', async () => {
    await seedDoors();
    await assertSucceeds(setDoc(doc(db(ALICE), 'links', `${BOB}__steward__com1`), link(BOB, 'steward', 'com1')));
    await assertFails(setDoc(doc(db(BOB), 'links', `${MALLORY}__steward__com1`), link(MALLORY, 'steward', 'com1')));
    await assertSucceeds(deleteDoc(doc(db(SAM), 'links', `${SAM}__steward__com1`)));   // steps down
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'links', `${BOB}__steward__com1`))); // owner removes
  });
});

describe('community invitations — the shareable key: live opens, revoked/expired/foreign do not', () => {
  const SAM = 'sam-uid';
  const link = (from: string, rel: string, to: string, extra: object = {}) =>
    ({ lid: 'x', type: 'link', rel, from, to, ...extra, createdAt: 1 });

  const seedInvites = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'communities', 'closed1'), { ownerId: ALICE, name: 'Closed', domain: 'c', door: 'closed' });
    await setDoc(doc(d, 'links', `${SAM}__steward__com1`), link(SAM, 'steward', 'com1'));
    await setDoc(doc(d, 'communityInvites', 'inv-live-0001'), { communityId: 'com1', createdBy: ALICE, createdAt: 1 });
    await setDoc(doc(d, 'communityInvites', 'inv-revoked-1'), { communityId: 'com1', createdBy: ALICE, createdAt: 1, revokedAt: Timestamp.fromMillis(1000) });
    await setDoc(doc(d, 'communityInvites', 'inv-expired-1'), { communityId: 'com1', createdBy: ALICE, createdAt: 1, expiresAt: Timestamp.fromMillis(1000) });
    await setDoc(doc(d, 'communityInvites', 'inv-future-01'), { communityId: 'com1', createdBy: ALICE, createdAt: 1, expiresAt: Timestamp.fromMillis(Date.now() + 86400000) });
    await setDoc(doc(d, 'communityInvites', 'inv-closed-01'), { communityId: 'closed1', createdBy: ALICE, createdAt: 1 });
  });

  it('a live invitation admits its holder — as a member of ITS community, with the edge carrying provenance', async () => {
    await seedInvites();
    await assertSucceeds(setDoc(doc(db(BOB), 'links', `${BOB}__member__com1`),
      link(BOB, 'member', 'com1', { inviteId: 'inv-live-0001' })));
  });

  it('an unexpired deadline admits; revoked and expired do not; a foreign invite opens nothing else', async () => {
    await seedInvites();
    await assertSucceeds(setDoc(doc(db(BOB), 'links', `${BOB}__member__com1`),
      link(BOB, 'member', 'com1', { inviteId: 'inv-future-01' })));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__member__com1`),
      link(MALLORY, 'member', 'com1', { inviteId: 'inv-revoked-1' })));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__member__com1`),
      link(MALLORY, 'member', 'com1', { inviteId: 'inv-expired-1' })));
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__member__closed1`),
      link(MALLORY, 'member', 'closed1', { inviteId: 'inv-live-0001' }))); // com1's key, closed1's door
  });

  it('a closed door refuses even its own valid invitation', async () => {
    await seedInvites();
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__member__closed1`),
      link(BOB, 'member', 'closed1', { inviteId: 'inv-closed-01' })));
  });

  it('invited_by is truthful, per-community provenance: only with a real invitation for THAT community', async () => {
    await seedInvites();
    // from = newcomer, to = the community; the inviter is recoverable via the invite's createdBy.
    await assertSucceeds(setDoc(doc(db(BOB), 'links', `${BOB}__invited_by__com1`),
      link(BOB, 'invited_by', 'com1', { inviteId: 'inv-live-0001' })));
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__invited_by__closed1`),
      link(BOB, 'invited_by', 'closed1', { inviteId: 'inv-live-0001' }))); // com1's key, closed1 named
    await assertFails(setDoc(doc(db(BOB), 'links', `${BOB}__invited_by__com1`),
      link(BOB, 'invited_by', 'com1'))); // no invitation at all
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${BOB}__invited_by__com1`),
      link(BOB, 'invited_by', 'com1', { inviteId: 'inv-live-0001' }))); // forged actor
  });

  it('the invited_by mark is append-only — not even its subject may erase how they arrived', async () => {
    await seedInvites();
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'links', `${BOB}__invited_by__com1`), link(BOB, 'invited_by', 'com1', { inviteId: 'inv-live-0001' })));
    await assertFails(deleteDoc(doc(db(BOB), 'links', `${BOB}__invited_by__com1`)));   // the subject cannot erase it
    await assertSucceeds(deleteDoc(doc(db(STAFF), 'links', `${BOB}__invited_by__com1`))); // staff remain the escape hatch
  });

  it('keepers mint and revoke; strangers hold the key but cannot cut new ones, and revocation is one-way', async () => {
    await seedInvites();
    await assertSucceeds(setDoc(doc(db(ALICE), 'communityInvites', 'inv-by-owner1'),
      { communityId: 'com1', createdBy: ALICE, createdAt: 1 }));
    await assertSucceeds(setDoc(doc(db(SAM), 'communityInvites', 'inv-by-stewrd'),
      { communityId: 'com1', createdBy: SAM, createdAt: 1 }));
    await assertFails(setDoc(doc(db(BOB), 'communityInvites', 'inv-by-nonkpr'),
      { communityId: 'com1', createdBy: BOB, createdAt: 1 })); // not a keeper
    await assertFails(setDoc(doc(db(ALICE), 'communityInvites', 'inv-forged-by'),
      { communityId: 'com1', createdBy: BOB, createdAt: 1 })); // keeper, but forged createdBy
    await assertSucceeds(getDoc(doc(db(), 'communityInvites', 'inv-live-0001'))); // link-holder GET, signed out
    await assertSucceeds(updateDoc(doc(db(ALICE), 'communityInvites', 'inv-live-0001'),
      { revokedAt: Timestamp.fromMillis(Date.now()) }));
    await assertFails(updateDoc(doc(db(MALLORY), 'communityInvites', 'inv-future-01'),
      { revokedAt: Timestamp.fromMillis(Date.now()) }));
    await assertFails(updateDoc(doc(db(ALICE), 'communityInvites', 'inv-future-01'),
      { communityId: 'other' })); // revocation is the ONLY mutation
    // Revocation is one-way: a revoked key is never resurrected by clearing revokedAt.
    await assertFails(updateDoc(doc(db(ALICE), 'communityInvites', 'inv-revoked-1'),
      { revokedAt: null }));
    await assertFails(deleteDoc(doc(db(ALICE), 'communityInvites', 'inv-live-0001'))); // never deleted, marked
  });
});

describe('link id-binding — authority resolves by path, so the doc id must equal from__rel__to', () => {
  const link = (from: string, rel: string, to: string, extra: object = {}) =>
    ({ lid: 'x', type: 'link', rel, from, to, ...extra, createdAt: 1 });

  it('a self-serve rel cannot masquerade at a privileged path (no steward/keeper by forgery)', async () => {
    // Mallory tries to land a 'joined' link (self-serve) at the steward path for com1.
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__steward__com1`), link(MALLORY, 'joined', MALLORY)));
    // And cannot forge tree-tender power by placing a self-serve rel at a co_owner path.
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__co_owner__treeB`), link(MALLORY, 'joined', MALLORY)));
    // The honest self-serve write (id matches data) still succeeds.
    await assertSucceeds(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__joined__vX`), link(MALLORY, 'joined', 'vX')));
  });
});

describe("beds — housed by a keeper or loose at a place; a bed never forges into a house", () => {
  const bed = (over: object = {}) => ({
    ownerId: ALICE, name: 'Cedar bed', body: 'Welcome, traveller.',
    treeType: 'BED', lightHouseId: 'lh1', visibility: 'node',
    createdAt: 1, genesisHash: 'g0', latestHash: 'g0', blockHeight: 0,
    validated: false, validatorId: null, ...over,
  });
  // A loose bed: no house — a coordinate under open stars.
  const looseBed = (over: object = {}) => {
    const { lightHouseId: _dropped, ...rest } = bed({ latitude: 6.03, longitude: 81.33 }) as Record<string, unknown>;
    return { ...rest, ...over };
  };

  it('the keeper plants a bed in their own house; staff may too', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'lifetrees', 'bed1'), bed()));
    await assertSucceeds(setDoc(doc(db(STAFF), 'lifetrees', 'bed2'), bed({ ownerId: STAFF })));
  });

  it("a stranger cannot plant a bed in someone else's house — nor the keeper in another's name", async () => {
    await assertFails(setDoc(doc(db(MALLORY), 'lifetrees', 'bedX'), bed({ ownerId: MALLORY }))); // not lh1's keeper
    await assertFails(setDoc(doc(db(ALICE), 'lifetrees', 'bedY'), bed({ ownerId: BOB })));       // forged owner
  });

  it('a loose bed at a coordinate is welcome — anyone, in their own name, no house needed', async () => {
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'bedL1'), looseBed({ ownerId: BOB })));
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'bedL2'),
      looseBed({ ownerId: BOB, lightHouseId: '' }))); // an explicit '' is loose too
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedLf'), looseBed({ ownerId: ALICE }))); // forged owner
  });

  it('a loose bed at a NON-place is refused: NaN, Infinity, and off-Earth coordinates are nowhere', async () => {
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedN'), looseBed({ ownerId: BOB, latitude: NaN, longitude: NaN })));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedI'), looseBed({ ownerId: BOB, latitude: Infinity })));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedJ'), looseBed({ ownerId: BOB, longitude: -Infinity })));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedO'), looseBed({ ownerId: BOB, latitude: 91 })));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedP'), looseBed({ ownerId: BOB, longitude: 181 })));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedQ'), looseBed({ ownerId: BOB, latitude: 999, longitude: -999 })));
    // The edges of the map are still places — the poles and the antimeridian welcome a bed.
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'bedR'), looseBed({ ownerId: BOB, latitude: 90, longitude: -180 })));
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'bedT'), looseBed({ ownerId: BOB, latitude: -90, longitude: 180 })));
    // And zero is a real place (the equator, the meridian).
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'bedU'), looseBed({ ownerId: BOB, latitude: 0, longitude: 0 })));
  });

  it('a bed with NEITHER a house NOR a place is still refused', async () => {
    const { latitude: _lat, longitude: _lng, ...nowhere } = looseBed();
    await assertFails(setDoc(doc(db(ALICE), 'lifetrees', 'bedZ'), nowhere));
    const { longitude: _half, ...halfPlaced } = looseBed();
    await assertFails(setDoc(doc(db(ALICE), 'lifetrees', 'bedH'), halfPlaced));            // half a coordinate
    await assertFails(setDoc(doc(db(ALICE), 'lifetrees', 'bedS'), looseBed({ latitude: '6.03' }))); // a string is no place
    // An ordinary tree still plants freely, house or no house.
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'tree2'),
      { ownerId: BOB, name: 'Oak', treeType: 'LIFETREE', createdAt: 1, validated: false, validatorId: null }));
  });

  it('a bed never carries a domain — housed or loose, at birth (keeper or staff) or by edit', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'lifetrees', 'bedD'), bed({ domain: 'lh.online' })));
    await assertFails(setDoc(doc(db(STAFF), 'lifetrees', 'bedE'), bed({ ownerId: STAFF, domain: 'lh.online' })));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedF'), looseBed({ ownerId: BOB, domain: 'lh.online' })));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'lifetrees', 'bed1'), bed());
      await setDoc(doc(ctx.firestore(), 'lifetrees', 'bedL1'), looseBed({ ownerId: BOB }));
    });
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { domain: 'lh.online' }));
    await assertFails(updateDoc(doc(db(BOB), 'lifetrees', 'bedL1'), { domain: 'lh.online' }));
    // An ordinary tree still carries and changes a domain freely — the exclusion is the bed's alone.
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'tree3'),
      { ownerId: BOB, name: 'Elm', treeType: 'LIFETREE', domain: 'com.online', createdAt: 1, validated: false, validatorId: null }));
    await assertSucceeds(updateDoc(doc(db(BOB), 'lifetrees', 'tree3'), { domain: 'other.online' }));
  });

  it('the domain-freeze binds even staff: a staff edit cannot give a bed a domain', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'lifetrees', 'bed1'), bed()));
    await assertFails(updateDoc(doc(db(STAFF), 'lifetrees', 'bed1'), { domain: 'lh.online' }));
    // Staff's broad powers otherwise breathe on — the frozen fields still bend to them.
    await assertSucceeds(updateDoc(doc(db(STAFF), 'lifetrees', 'bed1'),
      { name: 'Willow bed', validated: true, validatorId: STAFF }));
    // And a staff edit on an ordinary tree's domain remains free.
    await assertSucceeds(updateDoc(doc(db(STAFF), 'lifetrees', 'treeB'), { domain: 'staff.online' }));
  });

  it('a bed stays a bed — and a tree never becomes one', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'lifetrees', 'bed1'), bed()));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { name: 'Willow bed' }));
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { treeType: 'LIFETREE' }));   // out of bed-hood
    await assertFails(updateDoc(doc(db(BOB), 'lifetrees', 'treeB'), { treeType: 'BED' })); // never becomes one
    await assertSucceeds(updateDoc(doc(db(BOB), 'lifetrees', 'treeB'), { treeType: 'GUARDED', isNature: true })); // convert still breathes
  });

  it("containment is soft: a bed may go loose or come home, but never into a house its writer doesn't keep", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'lifetrees', 'bed1'), bed({ latitude: 6.03, longitude: 81.33 }));
      await setDoc(doc(ctx.firestore(), 'lightHouses', 'lh2'), { ownerId: BOB, name: "Bob's Light", lid: 'lh2-lid' });
    });
    // The owner may clear the house — the bed goes loose, chain intact.
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { lightHouseId: '' }));
    // And point it home again — ALICE keeps lh1.
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { lightHouseId: 'lh1' }));
    // But never into a house the writer does not keep — real (Bob's) or imaginary.
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { lightHouseId: 'lh2' }));
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { lightHouseId: 'lh-nowhere' }));
  });

  it('a loose bed keeps its REAL place for LIFE — no edit may strand it at a non-place', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'lifetrees', 'bedL1'), looseBed({ ownerId: BOB }));
      await setDoc(doc(ctx.firestore(), 'lifetrees', 'bed1'), bed()); // housed — carries no coordinate
    });
    // The owner may not push their own loose bed off the map, into NaN, or into nowhere.
    await assertFails(updateDoc(doc(db(BOB), 'lifetrees', 'bedL1'), { latitude: 999 }));
    await assertFails(updateDoc(doc(db(BOB), 'lifetrees', 'bedL1'), { latitude: NaN }));
    await assertFails(updateDoc(doc(db(BOB), 'lifetrees', 'bedL1'), { latitude: deleteField() }));
    // A coordinate-less housed bed cannot be cut loose into placelessness…
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'), { lightHouseId: '' }));
    // …but going loose WITH a real place remains a legitimate soft-home move.
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lifetrees', 'bed1'),
      { lightHouseId: '', latitude: 6.03, longitude: 81.33 }));
    // An overlay that leaves the coordinate untouched still breathes: initiate validation
    // on a real-placed loose bed (the after-state is still a real place).
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lifetrees', 'bedL1'),
      { validated: true, validatorId: ALICE, updatedAt: 1 }));
    // And an ordinary owner edit on the real-placed loose bed passes untroubled.
    await assertSucceeds(updateDoc(doc(db(BOB), 'lifetrees', 'bedL1'), { name: 'Fern bed' }));
  });

  it('bed-hood is immutable for EVERY writer — even staff cannot lift a bed into the forest', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'lifetrees', 'bed1'), bed({ validated: true, validatorId: STAFF })));
    // Staff can neither promote a bed out of bed-hood nor press a tree into it.
    await assertFails(updateDoc(doc(db(STAFF), 'lifetrees', 'bed1'), { treeType: 'LIFETREE' }));
    await assertFails(updateDoc(doc(db(STAFF), 'lifetrees', 'treeB'), { treeType: 'BED' }));
    // Staff's dimming hand still reaches a bed's validation…
    await assertSucceeds(updateDoc(doc(db(STAFF), 'lifetrees', 'bed1'), { validated: false, validatorId: null }));
    // …and the owner's LIFETREE<->GUARDED conversion still breathes, both ways.
    await assertSucceeds(updateDoc(doc(db(BOB), 'lifetrees', 'treeB'), { treeType: 'GUARDED' }));
    await assertSucceeds(updateDoc(doc(db(BOB), 'lifetrees', 'treeB'), { treeType: 'LIFETREE' }));
  });

  it('the place gate binds staff at birth too — no hand may plant a placeless loose bed', async () => {
    const { latitude: _lat, longitude: _lng, ...nowhere } = looseBed({ ownerId: STAFF });
    await assertFails(setDoc(doc(db(STAFF), 'lifetrees', 'bedSA'), nowhere));                                  // no coordinate
    await assertFails(setDoc(doc(db(STAFF), 'lifetrees', 'bedSB'), looseBed({ ownerId: STAFF, latitude: NaN }))); // a non-place
    await assertSucceeds(setDoc(doc(db(STAFF), 'lifetrees', 'bedSC'), looseBed({ ownerId: STAFF })));          // a real place
    await assertSucceeds(setDoc(doc(db(STAFF), 'lifetrees', 'bedSD'), bed({ ownerId: STAFF })));               // housed — no coordinate needed
  });
});

describe('stays — a request to sleep in a BED; hostUid is the bed keeper, frozen after birth', () => {
  const stay = (over: object = {}) => ({
    bedId: 'bedStay', bedName: 'Cedar', lightHouseId: 'lh1',
    uid: BOB, guestName: 'Bob', guestTreeId: 'gt', guestTreeName: 'Bob\'s Oak', guestTreeGrowthUrl: '',
    hostUid: ALICE, fromDate: '2026-09-01', toDate: '2026-09-04', nights: 3, status: 'requested', ...over,
  });

  it('a guest requests a stay on a bed — hostUid must be that bed\'s keeper', async () => {
    await assertSucceeds(setDoc(doc(db(BOB), 'stays', 's1'), stay()));
    await assertFails(setDoc(doc(db(BOB), 'stays', 's2'), stay({ hostUid: BOB })));        // forged host
    await assertFails(setDoc(doc(db(BOB), 'stays', 's3'), stay({ uid: ALICE })));           // forged guest
    await assertFails(setDoc(doc(db(BOB), 'stays', 's4'), stay({ status: 'accepted' })));   // no self-accept
    await assertFails(setDoc(doc(db(BOB), 'stays', 's5'), stay({ bedId: '' })));            // must name a bed
    await assertFails(setDoc(doc(db(BOB), 'stays', 's6'), stay({ fromDate: '2026-09-05', toDate: '2026-09-04' }))); // reversed range
    await assertFails(setDoc(doc(db(BOB), 'stays', 's7'), stay({ fromDate: '2026-09-04', toDate: '2026-09-04' }))); // zero nights
  });

  it('a stay cannot aim at a non-bed (only a BED carries beds)', async () => {
    // treeB is a LIFETREE owned by BOB — even as its owner, BOB cannot host a stay on it.
    await assertFails(setDoc(doc(db(BOB), 'stays', 'sT'), stay({ bedId: 'treeB', hostUid: BOB })));
  });

  it('only the bed keeper flips status; bedId and the guest face are frozen after birth', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'stays', 's1'), stay()));
    await assertFails(updateDoc(doc(db(BOB), 'stays', 's1'), { status: 'accepted' }));          // guest can't accept
    await assertSucceeds(updateDoc(doc(db(ALICE), 'stays', 's1'), { status: 'accepted' }));     // keeper can
    await assertFails(updateDoc(doc(db(ALICE), 'stays', 's1'), { status: 'accepted', bedId: 'other' })); // bedId frozen
    await assertFails(updateDoc(doc(db(ALICE), 'stays', 's1'), { guestTreeName: 'spoofed' }));  // the face is frozen
  });

  it('occupancy is public to read, keeper-only to write — no forged availability', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'lifetrees', 'bedStay', 'occupancy', 's1'), { fromDate: '2026-09-01', toDate: '2026-09-04' }));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedStay', 'occupancy', 's2'), { fromDate: '2026-09-10', toDate: '2026-09-12' }));
    await assertSucceeds(getDoc(doc(db(BOB), 'lifetrees', 'bedStay', 'occupancy', 's1'))); // any signed-in guest sees busy/free
    await assertSucceeds(getDoc(doc(db(), 'lifetrees', 'bedStay', 'occupancy', 's1')));    // public: a signed-OUT visitor too
  });

  it("a view-hold is yours alone — you cannot forge or steal another being's", async () => {
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'bedStay', 'holds', BOB), { holderUid: BOB, expiresAt: Date.now() + 60000 }));
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedStay', 'holds', ALICE), { holderUid: ALICE, expiresAt: Date.now() + 60000 })); // not your doc
    await assertFails(setDoc(doc(db(BOB), 'lifetrees', 'bedStay', 'holds', BOB), { holderUid: BOB, expiresAt: 9999999999999 })); // no far-future hostage
    await assertSucceeds(getDoc(doc(db(ALICE), 'lifetrees', 'bedStay', 'holds', BOB))); // readable by anyone signed in
  });
});

describe('networkInvites — consuming cannot rewrite the email, inviter, or the node it carries', () => {
  const seedInvite = () => env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), 'networkInvites', 'ninv1'), {
      email: 'newcomer@x.com', invitedByUserId: ALICE, status: 'pending', createdAt: 1,
      nodeCommunityId: 'com1', nodeDomain: 'perauset.com',
    }));

  it('the invited user consumes it — accepted, stamping themselves, node fields intact', async () => {
    await seedInvite();
    await assertSucceeds(updateDoc(doc(db(BOB), 'networkInvites', 'ninv1'),
      { status: 'accepted', acceptedByUserId: BOB, acceptedAt: 2 }));
  });

  it('cannot re-stamp the node, the inviter, the email, or accept as someone else', async () => {
    await seedInvite();
    await assertFails(updateDoc(doc(db(BOB), 'networkInvites', 'ninv1'),
      { status: 'accepted', acceptedByUserId: BOB, nodeCommunityId: 'other' }));   // forged node
    await assertFails(updateDoc(doc(db(BOB), 'networkInvites', 'ninv1'),
      { status: 'accepted', acceptedByUserId: BOB, nodeDomain: 'evil.com' }));      // forged domain
    await assertFails(updateDoc(doc(db(BOB), 'networkInvites', 'ninv1'),
      { status: 'accepted', acceptedByUserId: BOB, invitedByUserId: BOB }));        // forged inviter
    await assertFails(updateDoc(doc(db(BOB), 'networkInvites', 'ninv1'),
      { status: 'accepted', acceptedByUserId: MALLORY }));                          // accept as another
  });
});

describe("lightHouses — the community's choice is LAW: membership enforced at rest", () => {
  const CAROL = 'carol-uid'; // a keeper who consecrates houses in com1
  // BOB belongs to com1 (ALICE's community); MALLORY does not. Houses at each visibility tier.
  const seedHouses = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'links', `${BOB}__member__com1`), { lid: 'x', type: 'link', rel: 'member', from: BOB, to: 'com1', createdAt: 1 });
    await setDoc(doc(d, 'lightHouses', 'lhPublic'),  { ownerId: CAROL,   name: 'Beacon',    lid: 'lhp',  communityId: 'com1', visibility: 'public' });
    await setDoc(doc(d, 'lightHouses', 'lhNode'),    { ownerId: CAROL,   name: 'Nodehouse', lid: 'lhn',  communityId: 'com1', visibility: 'node' });
    await setDoc(doc(d, 'lightHouses', 'lhComm'),    { ownerId: CAROL,   name: 'Hearth',    lid: 'lhc',  communityId: 'com1', visibility: 'community' });
    await setDoc(doc(d, 'lightHouses', 'lhDefault'), { ownerId: CAROL,   name: 'Old',       lid: 'lhd',  communityId: 'com1' }); // absent visibility
    await setDoc(doc(d, 'lightHouses', 'lhMallory'), { ownerId: MALLORY, name: 'Mine',      lid: 'lhm',  communityId: 'com1', visibility: 'community' });
  });

  it('public houses are readable by everyone, signed-in or not', async () => {
    await seedHouses();
    await assertSucceeds(getDoc(doc(db(), 'lightHouses', 'lhPublic')));        // signed-out
    await assertSucceeds(getDoc(doc(db(BOB), 'lightHouses', 'lhPublic')));     // member
    await assertSucceeds(getDoc(doc(db(MALLORY), 'lightHouses', 'lhPublic'))); // non-member
  });

  it('node houses open to any signed-in being, but the signed-out are turned away', async () => {
    await seedHouses();
    await assertSucceeds(getDoc(doc(db(BOB), 'lightHouses', 'lhNode')));
    await assertSucceeds(getDoc(doc(db(MALLORY), 'lightHouses', 'lhNode'))); // signed-in non-member still sees node
    await assertFails(getDoc(doc(db(), 'lightHouses', 'lhNode')));           // signed-out cannot
  });

  it('a community house is law: a member reads it; a signed-in NON-member cannot; nor the signed-out', async () => {
    await seedHouses();
    await assertSucceeds(getDoc(doc(db(BOB), 'lightHouses', 'lhComm')));   // member link
    await assertSucceeds(getDoc(doc(db(ALICE), 'lightHouses', 'lhComm'))); // com1's owner is a member
    await assertFails(getDoc(doc(db(MALLORY), 'lightHouses', 'lhComm')));  // signed-in, but no membership — the veil is now a wall
    await assertFails(getDoc(doc(db(), 'lightHouses', 'lhComm')));         // signed-out
  });

  it('absent visibility behaves as community — the default is private, member-only', async () => {
    await seedHouses();
    await assertSucceeds(getDoc(doc(db(BOB), 'lightHouses', 'lhDefault')));
    await assertFails(getDoc(doc(db(MALLORY), 'lightHouses', 'lhDefault')));
    await assertFails(getDoc(doc(db(), 'lightHouses', 'lhDefault')));
  });

  it('the owner reads their own community house even as a non-member; staff read any', async () => {
    await seedHouses();
    await assertSucceeds(getDoc(doc(db(MALLORY), 'lightHouses', 'lhMallory'))); // owner, though not in com1
    await assertSucceeds(getDoc(doc(db(STAFF), 'lightHouses', 'lhComm')));      // staff sees any
    await assertSucceeds(getDoc(doc(db(STAFF), 'lightHouses', 'lhDefault')));
  });
});

describe('visions — the idea-twin grows its own chain; the genesis is frozen', () => {
  // BOB authors the vision; its head advances by contributions (growVision), its root is sealed once.
  const seedVisions = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'visions', 'v1'), {
      authorId: BOB, title: 'V', visibility: 'public', lid: 'v1-lid',
      genesisHash: 'g0', latestHash: 'g0', blockHeight: 0,
    });
    // A legacy vision, minted before the twins grew chains — no genesis yet.
    await setDoc(doc(d, 'visions', 'vLegacy'), { authorId: BOB, title: 'Old', visibility: 'public', lid: 'vL-lid' });
  });

  it('the author advances the chain — latestHash/blockHeight move freely (a contribution seals)', async () => {
    await seedVisions();
    await assertSucceeds(updateDoc(doc(db(BOB), 'visions', 'v1'), { latestHash: 'h1', blockHeight: 1 }));
  });

  it("a stranger cannot grow (advance) someone else's vision", async () => {
    await seedVisions();
    await assertFails(updateDoc(doc(db(MALLORY), 'visions', 'v1'), { latestHash: 'h1', blockHeight: 1 }));
  });

  it('the genesis is frozen — even the author cannot rewrite or forge it, alone or smuggled along', async () => {
    await seedVisions();
    await assertFails(updateDoc(doc(db(BOB), 'visions', 'v1'), { genesisHash: 'forged' }));
    await assertFails(updateDoc(doc(db(BOB), 'visions', 'v1'), { latestHash: 'h1', blockHeight: 1, genesisHash: 'forged' }));
  });

  it('a legacy vision may be BORN a chain once (absent genesis set) — by its author or by staff (the backfill)', async () => {
    await seedVisions();
    await assertSucceeds(updateDoc(doc(db(BOB), 'visions', 'vLegacy'), { genesisHash: 'g0', latestHash: 'g0', blockHeight: 0 }));
    await seedVisions(); // reset the legacy vision back to chainless
    await assertSucceeds(updateDoc(doc(db(STAFF), 'visions', 'vLegacy'), { genesisHash: 'g0', latestHash: 'g0', blockHeight: 0 }));
  });

  it('the lid stays frozen on a vision (the true name is load-bearing)', async () => {
    await seedVisions();
    await assertFails(updateDoc(doc(db(BOB), 'visions', 'v1'), { lid: 'forged' }));
  });
});

describe('covenants — the two-sided mint: proposer names parties, each signs only their own slot', () => {
  const CAROL = 'carol-uid';
  // cov1: ALICE proposes; ALICE + BOB are its two parties (quorum 2). ALICE is both proposer and party.
  const seedCov = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'covenants', 'cov1'), {
      lid: 'cov1-lid', genesisHash: 'g0', latestHash: 'g0', blockHeight: 0,
      kind: 'covenant', title: 'We tend together', body: 'Each waters when able.',
      quorum: 2, proposedBy: ALICE, status: 'proposed',
    });
    await setDoc(doc(d, 'links', `${ALICE}__party__cov1`), { lid: 'pa', type: 'link', rel: 'party', from: ALICE, to: 'cov1', role: 'initiator', createdAt: 1 });
    await setDoc(doc(d, 'links', `${BOB}__party__cov1`), { lid: 'pb', type: 'link', rel: 'party', from: BOB, to: 'cov1', createdAt: 1 });
  });
  const covDoc = (over: object = {}) => ({
    lid: 'l', genesisHash: 'g', latestHash: 'g', blockHeight: 0,
    kind: 'covenant', title: 'T', body: 'B', quorum: 1, proposedBy: ALICE, status: 'proposed', ...over,
  });
  const party = (uid: string, extra: object = {}) => ({ lid: 'x', type: 'link', rel: 'party', from: uid, to: 'cov1', ...extra, createdAt: 1 });
  const sig = { sig: 'base64-signature', pubkey: 'base64-spki-pubkey', signedAt: 1 };

  it('the proposer creates it naming themselves; a stranger cannot forge the proposer', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'covenants', 'covA'), covDoc()));
    await assertFails(setDoc(doc(db(MALLORY), 'covenants', 'covB'), covDoc()));            // proposedBy != writer
    await assertSucceeds(setDoc(doc(db(MALLORY), 'covenants', 'covC'), covDoc({ proposedBy: MALLORY })));
  });

  it('ONLY the proposer mints party links — a party (non-proposer) or stranger cannot add to the roster', async () => {
    await seedCov();
    await assertSucceeds(setDoc(doc(db(ALICE), 'links', `${CAROL}__party__cov1`), party(CAROL)));   // proposer names a party
    await assertFails(setDoc(doc(db(BOB), 'links', `${MALLORY}__party__cov1`), party(MALLORY)));    // BOB is a party, not the proposer
    await assertFails(setDoc(doc(db(MALLORY), 'links', `${MALLORY}__party__cov1`), party(MALLORY))); // a stranger
    // A party link cannot masquerade at a privileged path either (id must equal from__party__to).
    await assertFails(setDoc(doc(db(ALICE), 'links', `${CAROL}__steward__cov1`), party(CAROL)));
  });

  it('a party signs ONLY their own slot; a stranger cannot sign at all', async () => {
    await seedCov();
    await assertSucceeds(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), sig));          // own slot
    await assertFails(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', ALICE), sig));           // another's slot
    await assertFails(setDoc(doc(db(MALLORY), 'covenants', 'cov1', 'signatures', MALLORY), sig));     // not a party
  });

  it('a signature is immutable once written — even by its own signer', async () => {
    await seedCov();
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'covenants', 'cov1', 'signatures', BOB), sig));
    await assertFails(updateDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), { sig: 'forged' }));
  });

  it('FIELD-LOCK: a signature carrying a body `uid` (or any extra field) is REFUSED — the doc id is the only signer', async () => {
    await seedCov();
    // The quorum-inflation write: a party smuggles a body uid claiming another signer's hand.
    await assertFails(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), { ...sig, uid: ALICE }));
    await assertFails(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), { ...sig, uid: BOB }));   // even their own
    await assertFails(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), { ...sig, extra: 'x' }));
    // The legit field set still lands.
    await assertSucceeds(setDoc(doc(db(BOB), 'covenants', 'cov1', 'signatures', BOB), sig));
  });

  it('the identity is FROZEN — only status + chain head advance; title/quorum/proposedBy cannot move', async () => {
    await seedCov();
    // A party seals: status + head only — allowed.
    await assertSucceeds(updateDoc(doc(db(BOB), 'covenants', 'cov1'), { status: 'sealed', latestHash: 'h1', blockHeight: 1, sealedAt: 2 }));
    await seedCov();
    await assertFails(updateDoc(doc(db(BOB), 'covenants', 'cov1'), { title: 'changed' }));
    await assertFails(updateDoc(doc(db(BOB), 'covenants', 'cov1'), { quorum: 1 }));
    await assertFails(updateDoc(doc(db(BOB), 'covenants', 'cov1'), { genesisHash: 'forged' }));
    await assertFails(updateDoc(doc(db(ALICE), 'covenants', 'cov1'), { proposedBy: MALLORY }));
    await assertFails(updateDoc(doc(db(BOB), 'covenants', 'cov1'), { status: 'sealed', quorum: 1 })); // no smuggling alongside
  });

  it('a non-party, non-proposer cannot advance the covenant', async () => {
    await seedCov();
    await assertFails(updateDoc(doc(db(MALLORY), 'covenants', 'cov1'), { status: 'broken' }));
  });

  it('the roster is append-only — a party may not delete their own slot; staff may mend', async () => {
    await seedCov();
    await assertFails(deleteDoc(doc(db(BOB), 'links', `${BOB}__party__cov1`)));
    await assertSucceeds(deleteDoc(doc(db(STAFF), 'links', `${BOB}__party__cov1`)));
  });

  it('the roster is frozen once SEALED — the proposer cannot add a party to repudiate a sealed covenant', async () => {
    await seedCov();
    // While still 'proposed', the proposer may extend the roster (the atomic-mint path).
    await assertSucceeds(setDoc(doc(db(ALICE), 'links', `${CAROL}__party__cov1`), party(CAROL)));
    // Seal it, then the identity (roster included) is frozen: even the proposer cannot add a party,
    // which would otherwise change the signed identity and un-verify every existing signature.
    await env.withSecurityRulesDisabled(async (ctx) =>
      updateDoc(doc(ctx.firestore(), 'covenants', 'cov1'), { status: 'sealed' }));
    await assertFails(setDoc(doc(db(ALICE), 'links', `${MALLORY}__party__cov1`), party(MALLORY)));
  });
});

describe('decision signatures — a decision the community SIGNS: member-gated, own-slot, immutable', () => {
  // A charter decision (a pulse of type 'decision') in ALICE's community com1. BOB is a member of com1;
  // MALLORY is not. Each member signs ONLY their own slot in pulses/{id}/signatures/{uid}.
  const seedDecision = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'pulses', 'dec1'), {
      type: 'decision', lid: 'dec1-lid', communityId: 'com1',
      nature: 'charter', title: 'Adopt the charter', body: 'We tend together.',
      proposedBy: ALICE, mode: 'threshold', votes: [ALICE], votesRequired: 7,
      status: 'open', previousHash: 'DECISION', hash: 'h0', createdAt: 1,
    });
    // BOB joins com1 (a member link); ALICE is com1's owner (implicitly a member).
    await setDoc(doc(d, 'links', `${BOB}__member__com1`), { lid: 'x', type: 'link', rel: 'member', from: BOB, to: 'com1', createdAt: 1 });
  });
  const sig = { sig: 'base64-signature', pubkey: 'base64-spki-pubkey', signedAt: 1 };

  it('a community member signs their OWN slot; a non-member cannot sign at all', async () => {
    await seedDecision();
    await assertSucceeds(setDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', BOB), sig));      // member, own slot
    await assertSucceeds(setDoc(doc(db(ALICE), 'pulses', 'dec1', 'signatures', ALICE), sig));  // owner is a member
    await assertFails(setDoc(doc(db(MALLORY), 'pulses', 'dec1', 'signatures', MALLORY), sig)); // not a member of com1
  });

  it('a member may sign only their OWN slot — never another member\'s', async () => {
    await seedDecision();
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', ALICE), sig)); // BOB writing ALICE's slot
  });

  it('a signature is immutable once written — even by its own signer', async () => {
    await seedDecision();
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'pulses', 'dec1', 'signatures', BOB), sig));
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', BOB), { sig: 'forged' }));
  });

  it('FIELD-LOCK: a signature carrying a body `uid` (or any extra field) is REFUSED; the legit sets still land', async () => {
    await seedDecision();
    // The quorum-inflation write: a member smuggles a body uid claiming another signer's hand.
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', BOB), { ...sig, uid: ALICE }));
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', BOB), { ...sig, uid: BOB }));   // even their own
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', BOB), { ...sig, extra: 'x' }));
    // The legit field sets: threshold (sig/pubkey/signedAt) and consensus (+ position).
    await assertSucceeds(setDoc(doc(db(BOB), 'pulses', 'dec1', 'signatures', BOB), sig));
    await assertSucceeds(setDoc(doc(db(ALICE), 'pulses', 'dec1', 'signatures', ALICE), { ...sig, position: 'unite' }));
  });

  it('signatures attach only to a DECISION pulse, not an ordinary event', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'pulses', 'ev1'), { type: 'event', communityId: 'com1', title: 'Gathering', createdAt: 1 });
      await setDoc(doc(d, 'links', `${BOB}__member__com1`), { lid: 'x', type: 'link', rel: 'member', from: BOB, to: 'com1', createdAt: 1 });
    });
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'ev1', 'signatures', BOB), sig));
  });

  it('the STATUS flag is not the seal — a mere member cannot flip a decision to passed (the enactment gate holds)', async () => {
    await seedDecision();
    // Even a signer cannot self-declare the circle's will: flipping status stays with proposer/owner/staff.
    // (Enactment is authoritative only when the VERIFIED signatures meet the quorum — the crypto, not the
    // flag; a member landing a signature never gains the power to flip the flag on their own.)
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'dec1'), { status: 'passed', passedAt: 2 }));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'pulses', 'dec1'), { status: 'passed', passedAt: 2 })); // proposer/owner
  });
});

describe('persons key history — append-only lineage at persons/{uid}/keys/{fingerprint}', () => {
  const FP = 'a'.repeat(64); // a stable fingerprint-shaped doc id
  const keyDoc = { pubkey: 'base64-spki-key-A', publishedAt: 1 };

  it('the owner records their own key; a stranger cannot write into another\'s history', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'persons', ALICE, 'keys', FP), keyDoc));
    await assertFails(setDoc(doc(db(MALLORY), 'persons', ALICE, 'keys', 'other-fp'), keyDoc));
  });

  it('exactly { pubkey, publishedAt } — extra fields and an empty pubkey are refused', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'persons', ALICE, 'keys', FP), { ...keyDoc, extra: 'x' }));
    await assertFails(setDoc(doc(db(ALICE), 'persons', ALICE, 'keys', FP), { pubkey: '', publishedAt: 1 }));
  });

  it('append-only: the recorded pubkey can never change under its fingerprint; re-publishing the SAME key may merge; no delete, not even staff', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'persons', ALICE, 'keys', FP), keyDoc));
    await assertFails(updateDoc(doc(db(ALICE), 'persons', ALICE, 'keys', FP), { pubkey: 'a-DIFFERENT-key' }));
    await assertSucceeds(setDoc(doc(db(ALICE), 'persons', ALICE, 'keys', FP), keyDoc, { merge: true })); // same-key no-op
    await assertFails(deleteDoc(doc(db(ALICE), 'persons', ALICE, 'keys', FP)));
    await assertFails(deleteDoc(doc(db(STAFF), 'persons', ALICE, 'keys', FP)));
  });

  it('the TIMELINE is as frozen as the key: publishedAt can never be rewritten (verification stands on the lineage)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'persons', ALICE, 'keys', FP), keyDoc));
    await assertFails(updateDoc(doc(db(ALICE), 'persons', ALICE, 'keys', FP), { publishedAt: 2 }));
    await assertFails(setDoc(doc(db(ALICE), 'persons', ALICE, 'keys', FP), { ...keyDoc, publishedAt: 99 }, { merge: true }));
  });

  it('the history is world-readable — anyone can verify lineage', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'persons', ALICE, 'keys', FP), keyDoc));
    await assertSucceeds(getDoc(doc(db(), 'persons', ALICE, 'keys', FP)));
  });
});

describe('draft vanishes, minted withdraws — the decision delete rule and the chain marks', () => {
  // A decision still in DRAFT substance (not passed, only the proposer's own voice, no positions)
  // may be deleted by its author; anything shared or enacted may only be WITHDRAWN. Signatures live
  // in a subcollection the rules cannot read — that half of the guard is the service's
  // (deleteDecision / domain decisionDeletable); here the doc-visible half is law.
  const seedDec = (id: string, data: object) => env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), 'pulses', id), {
      type: 'decision', lid: `${id}-lid`, communityId: 'com1', nature: 'charter',
      title: 'T', body: '', proposedBy: ALICE, authorId: ALICE, mode: 'threshold',
      votes: [ALICE], votesRequired: 7, status: 'open',
      previousHash: 'DECISION', hash: 'h0', createdAt: 1, ...data,
    }));

  it('the author deletes their own unsigned, unshared draft', async () => {
    await seedDec('dr1', {});
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'pulses', 'dr1')));
  });

  it('a PASSED decision can never be deleted by its author/keeper — minted withdraws', async () => {
    await seedDec('dp1', { status: 'passed' });
    await assertFails(deleteDoc(doc(db(ALICE), 'pulses', 'dp1')));
  });

  it('a second voice protects the record: votes beyond the proposer forbid deletion', async () => {
    await seedDec('dv1', { votes: [ALICE, BOB] });
    await assertFails(deleteDoc(doc(db(ALICE), 'pulses', 'dv1')));
    // hasOnly, not size: a malformed/legacy array holding someone ELSE's single voice still protects.
    await seedDec('dv2', { votes: [BOB] });
    await assertFails(deleteDoc(doc(db(ALICE), 'pulses', 'dv2')));
  });

  it('a recorded position protects the record too (the consensus voices)', async () => {
    await seedDec('dpos1', { positions: [{ by: BOB, stance: 'stand_aside', note: '', at: 1 }] });
    await assertFails(deleteDoc(doc(db(ALICE), 'pulses', 'dpos1')));
  });

  it('staff keep the mend-anything escape; an ordinary event\'s deletion is untouched', async () => {
    await seedDec('dp2', { status: 'passed' });
    await assertSucceeds(deleteDoc(doc(db(STAFF), 'pulses', 'dp2')));
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'pulses', 'ev2'), { type: 'event', communityId: 'com1', authorId: ALICE, title: 'Fire', createdAt: 1 }));
    await assertSucceeds(deleteDoc(doc(db(ALICE), 'pulses', 'ev2')));
  });

  it('chain marks move only WITH a status change: a voter cannot scribble enactedHash or withdrawnHash alone', async () => {
    await seedDec('dm1', {});
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'dm1'), { enactedHash: 'forged' }));
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'dm1'), { withdrawnHash: 'forged' }));
    // The real withdrawal write — status + mark together, by the proposer — lands.
    await assertSucceeds(updateDoc(doc(db(ALICE), 'pulses', 'dm1'), { status: 'withdrawn', listening: false, withdrawnAt: 2, withdrawnHash: 'wh1' }));
    // And a plain vote append by a member still works (the overlay stays open to voices).
    await seedDec('dm2', {});
    await assertSucceeds(updateDoc(doc(db(BOB), 'pulses', 'dm2'), { votes: [ALICE, BOB] }));
  });
});

describe('rays — light is server-minted and privately read (the sun ring, domain/light)', () => {
  const ray = { holderUid: ALICE, role: 'carer', sourceUid: ALICE, treeId: 't1', units: 100, pulseId: 'p1' };

  it('no client may EVER write a ray — light can never be self-minted', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'rays', 'p1__carer'), ray));           // not even your own
    await assertFails(setDoc(doc(db(STAFF), 'rays', 'p1__carer'), ray));           // not even staff
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'rays', 'p1__carer'), ray));
    await assertFails(updateDoc(doc(db(ALICE), 'rays', 'p1__carer'), { units: 999 }));
    await assertFails(deleteDoc(doc(db(ALICE), 'rays', 'p1__carer')));
  });

  it('a being reads only their OWN light; another\'s rays stay private (staff may audit)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'rays', 'p1__carer'), ray));
    await assertSucceeds(getDoc(doc(db(ALICE), 'rays', 'p1__carer')));   // the holder
    await assertFails(getDoc(doc(db(BOB), 'rays', 'p1__carer')));        // not another being
    await assertSucceeds(getDoc(doc(db(STAFF), 'rays', 'p1__carer')));   // staff audit
  });
});

describe('glow — the commons ledger is server-written, communally read (the last spend)', () => {
  it('no client may write the glow, not even staff; the server alone feeds the commons', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'glow', 'c1'), { units: 999 }));
    await assertFails(setDoc(doc(db(STAFF), 'glow', 'c1'), { units: 999 }));
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'glow', 'c1'), { units: 14 }));
    await assertFails(updateDoc(doc(db(ALICE), 'glow', 'c1'), { units: 999 }));
    await assertFails(deleteDoc(doc(db(ALICE), 'glow', 'c1')));
  });

  it('any signed-in being may read a community\'s warmth; the world outside may not', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'glow', 'c1'), { units: 14 }));
    await assertSucceeds(getDoc(doc(db(ALICE), 'glow', 'c1')));  // communal, not a private balance
    await assertSucceeds(getDoc(doc(db(BOB), 'glow', 'c1')));
    await assertFails(getDoc(doc(db(), 'glow', 'c1')));          // anonymous stays outside
  });
});

describe('loves: any being may be loved, the count only, the slot only your own', () => {
  it('a signed-in being loves ANOTHER\'s tree: their own love slot + a loveCount-only bump', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'lifetrees', 'treeB', 'loves', ALICE), { uid: ALICE, createdAt: 1 }));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'lifetrees', 'treeB'), { loveCount: 1, updatedAt: 1 }));
  });

  it('the same universal love works on a community, a bed and a Light House', async () => {
    await assertSucceeds(setDoc(doc(db(BOB), 'communities', 'com1', 'loves', BOB), { uid: BOB, createdAt: 1 }));
    await assertSucceeds(updateDoc(doc(db(BOB), 'communities', 'com1'), { loveCount: 1, updatedAt: 1 }));
    await assertSucceeds(setDoc(doc(db(BOB), 'lifetrees', 'bedStay', 'loves', BOB), { uid: BOB, createdAt: 1 }));
    await assertSucceeds(updateDoc(doc(db(BOB), 'lifetrees', 'bedStay'), { loveCount: 1, updatedAt: 1 }));
    await assertSucceeds(setDoc(doc(db(BOB), 'lightHouses', 'lh1', 'loves', BOB), { uid: BOB, createdAt: 1 }));
    await assertSucceeds(updateDoc(doc(db(BOB), 'lightHouses', 'lh1'), { loveCount: 1, updatedAt: 1 }));
  });

  it('you may write ONLY your own love slot, and the love overlay may touch NOTHING but the count', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'lifetrees', 'treeB', 'loves', BOB), { uid: BOB, createdAt: 1 })); // not your slot
    await assertFails(updateDoc(doc(db(ALICE), 'lifetrees', 'treeB'), { loveCount: 1, name: 'stolen', updatedAt: 1 })); // rides a name change
    await assertFails(updateDoc(doc(db(BOB), 'communities', 'com1'), { loveCount: 1, ownerId: BOB, updatedAt: 1 })); // a stranger cannot seize ownership through a love
  });

  it('the anonymous cannot love', async () => {
    await assertFails(setDoc(doc(db(), 'lifetrees', 'treeB', 'loves', 'x'), { uid: 'x', createdAt: 1 }));
    await assertFails(updateDoc(doc(db(), 'lifetrees', 'treeB'), { loveCount: 1, updatedAt: 1 }));
  });

  it('a love slot is private: you may read your OWN, never another being\'s (a private tree must not leak its lovers)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'lifetrees', 'treeB', 'loves', ALICE), { uid: ALICE, createdAt: 1 });
    });
    await assertSucceeds(getDoc(doc(db(ALICE), 'lifetrees', 'treeB', 'loves', ALICE))); // my own mark
    await assertFails(getDoc(doc(db(BOB), 'lifetrees', 'treeB', 'loves', ALICE)));       // not mine to see
    await assertFails(getDoc(doc(db(), 'lifetrees', 'treeB', 'loves', ALICE)));          // nor the outside's
  });
});

describe('watering pulses — the light-mint trust root (server-mediated; Lumo review 2026-07-20)', () => {
  // treeB is owned by BOB (a tender). ALICE/MALLORY are not tenders of it.
  const water = (over: Record<string, any> = {}) => ({
    type: 'tree_growth', care: 'watering', lifetreeId: 'treeB', authorId: BOB,
    title: 'W', body: 'w', wateringConfirmedBy: 'pending', createdAt: 1, ...over,
  });

  it('a TENDER authors their OWN watering; a non-tender cannot, and authorId is bound to the author', async () => {
    await assertSucceeds(setDoc(doc(db(BOB), 'pulses', 'w1'), water()));                       // owner = tender, own author
    await assertFails(setDoc(doc(db(MALLORY), 'pulses', 'w2'), water({ authorId: MALLORY })));  // not a tender of treeB
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'w3'), water({ authorId: ALICE })));        // author must be the writer
  });

  it('no client may self-declare a guardian witness at creation (that is the callable\'s job)', async () => {
    await assertFails(setDoc(doc(db(BOB), 'pulses', 'w4'), water({ wateringConfirmedBy: 'guardian' })));
    await assertSucceeds(setDoc(doc(db(BOB), 'pulses', 'w5'), water({ wateringConfirmedBy: 'ai' }))); // AI hint is validation-only
  });

  it('confirmation is SERVER-ONLY: no client — not even a tender — may write wateringConfirmedBy / wateringConfirmation', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'pulses', 'w6'), water()));
    await assertFails(updateDoc(doc(db(BOB), 'pulses', 'w6'), { wateringConfirmedBy: 'guardian', wateringConfirmation: { confirmedByUid: BOB }, updatedAt: 2 }));
    await assertFails(updateDoc(doc(db(MALLORY), 'pulses', 'w6'), { wateringConfirmedBy: 'guardian', updatedAt: 2 }));
  });
});
