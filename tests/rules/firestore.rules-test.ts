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
