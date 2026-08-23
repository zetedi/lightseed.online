import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateSeed, keypairFromSeed, signPayload, verifyPayload } from '../../src/services/signingCrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where,
  serverTimestamp, runTransaction, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { uuidv7 } from '../../src/utils/id';
import { createBlock, sha256 } from '../../src/domain/chain';
import { buildThreadId } from '../../src/utils/reachPermissions';
import { linkId } from '../../src/domain/link';
import { dataAuthorityOf } from '../../src/domain/dataAuthority';
import {
  TRAVEL_PLAN, travelRuleFor, buildCensus, manifestHashOf, verifyBundle, collectionSignature,
  BUNDLE_SEAL_TAG, verifyBundleSeal, type BundleSealAnchor,
  chainClosureIssues, beingsIndexIssues, localUidCensus, expectedBeingsIndex, docContentHash,
  BUNDLE_FORMAT_VERSION, type BundleDoc, type CharterHead, type NodeBundle,
} from '../../src/domain/bundle';
import {
  PROJECT_A, PROJECT_B, bringToLife, releasePersonas, waitFor, wipeProject,
  adminDbA, adminDbB, type Persona,
} from './world';

// THE GROVE and THE CROSSING (ring 2026-08-15). The Grove: three beings walk the living
// path through the REAL rules, REAL callables and REAL triggers — nothing mocked, nothing
// bypassing the node's skin but the one named admin hand (the backend the node already
// trusts). The Crossing: the world the Grove just lived is exported under the bundle law,
// verified, restored into a second database (a genuinely separate emulator project with no
// functions watching it), and verified again — the node multiplies, and the charter, the
// chains, the graph and the census all survive the water.

const DOMAIN = 'lightseed.online';
const NODE_LID = '019f6381-48fd-7fcc-9382-e99d923f38aa';

let ana: Persona;    // founder; the node's one staff hand
let bakr: Persona;   // guardian and witness
let chen: Persona;   // joins, keeps, stays

const ids = {
  treeAna: '', treeBakr: '', treeChen: '',
  wateringPulse: '', reachThreadId: '', reachMsg: '',
  vision: '', community: '', treeInvite: '', keeperInvite: '',
  lightHouse: '', bed: '', stay: '', event: '',
};

// A client-lawful planting — the exact shape plantLifetree writes, minus the browser.
const plant = async (p: Persona, name: string, over: Record<string, unknown> = {}) => {
  const genesisHash = await createBlock('0', { msg: 'Birth' }, Date.now());
  const ref = doc(collection(p.db, 'lifetrees'));
  await setDoc(ref, {
    lid: uuidv7(), ownerId: p.uid, name, domain: DOMAIN, visibility: 'public',
    treeType: 'LIFETREE', onlyValidatedCanReach: false,
    createdAt: serverTimestamp(), genesisHash, latestHash: genesisHash, blockHeight: 0,
    validated: false, validatorId: null, status: 'HEALTHY', loveCount: 0,
    ...over,
  });
  return ref.id;
};

// A client-lawful chain mint — mintPulse's transaction, faithfully: block + head, atomic.
const mint = async (p: Persona, treeId: string, pulseData: Record<string, unknown>, extraTreeUpdate: Record<string, unknown> = {}) => {
  const pulseRef = doc(collection(p.db, 'pulses'));
  await runTransaction(p.db, async (t) => {
    const treeSnap = await t.get(doc(p.db, 'lifetrees', treeId));
    const tree = treeSnap.data() as Record<string, any>;
    const mintedAt = Date.now();
    const record = {
      lid: uuidv7(mintedAt), ...pulseData, domain: tree.domain || DOMAIN, id: pulseRef.id,
      visibility: pulseData.visibility || 'public', loveCount: 0, commentCount: 0,
      mintedAt, previousHash: tree.latestHash,
    };
    const hash = await createBlock(tree.latestHash, pulseData, mintedAt);
    t.set(pulseRef, { ...record, createdAt: serverTimestamp(), hash });
    t.update(doc(p.db, 'lifetrees', treeId), {
      latestHash: hash, blockHeight: (tree.blockHeight || 0) + 1, ...extraTreeUpdate,
    });
  });
  return pulseRef.id;
};

beforeAll(async () => {
  await wipeProject(PROJECT_A);
  await wipeProject(PROJECT_B);
  [ana, bakr, chen] = await Promise.all([
    bringToLife('Ana', uuidv7()), bringToLife('Bakr', uuidv7()), bringToLife('Chen', uuidv7()),
  ]);
  // The node's one staff grant — written by the backend hand, as on the real node.
  await adminDbA().doc(`admins/${ana.uid}`).set({ grantedAt: new Date() });
});

afterAll(async () => { await releasePersonas(); });

describe('the Grove — the living path, walked in parallel', () => {
  it('three beings arrive: users + persons, and the index triggers name them', async () => {
    await Promise.all([ana, bakr, chen].map(async (p) => {
      await setDoc(doc(p.db, 'users', p.uid), {
        lid: p.lid, email: `${p.name.toLowerCase()}@grove.demo`, displayName: p.name,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(p.db, 'persons', p.uid), {
        lid: p.lid, uid: p.uid, displayName: p.name, publicKeyPem: null, createdAt: serverTimestamp(),
      });
    }));
    // The REAL indexPersonLid trigger writes beings/{lid} — the true names arrive async.
    for (const p of [ana, bakr, chen]) {
      const entry = await waitFor(async () => (await adminDbA().doc(`beings/${p.lid}`).get()).data(), `beings/${p.lid}`);
      expect(entry.collection).toBe('users');
      expect(entry.docId).toBe(p.uid);
    }
  });

  it('three trees are planted in parallel and indexed by their true names', async () => {
    const [a, b, c] = await Promise.all([
      plant(ana, "Ana's Olive"), plant(bakr, "Bakr's Sycamore"), plant(chen, "Chen's Willow"),
    ]);
    ids.treeAna = a; ids.treeBakr = b; ids.treeChen = c;
    const anaLid = ((await getDoc(doc(ana.db, 'lifetrees', a))).data() as any).lid;
    const entry = await waitFor(async () => (await adminDbA().doc(`beings/${anaLid}`).get()).data(), 'tree being entry');
    expect(entry.collection).toBe('lifetrees');
  });

  it('the web of trust: staff validates, then a peer signs with their validated tree', async () => {
    await updateDoc(doc(ana.db, 'lifetrees', ids.treeBakr), { validated: true, validatorId: ana.uid, updatedAt: serverTimestamp() });
    await updateDoc(doc(bakr.db, 'lifetrees', ids.treeChen), { validated: true, validatorId: ids.treeBakr, updatedAt: serverTimestamp() });
    expect(((await getDoc(doc(chen.db, 'lifetrees', ids.treeChen))).data() as any).validated).toBe(true);
  });

  it('guardianship precedes the watering (tenure is law)', async () => {
    await setDoc(doc(bakr.db, 'links', linkId(bakr.uid, 'guardian', ids.treeAna)), {
      lid: uuidv7(), type: 'link', rel: 'guardian', from: bakr.uid, to: ids.treeAna, createdAt: serverTimestamp(),
    });
  });

  it('Ana waters; Bakr witnesses through the REAL callable; REAL light is minted', async () => {
    ids.wateringPulse = await mint(ana, ids.treeAna, {
      type: 'tree_growth', care: 'watering', title: 'Watering',
      body: 'Watered — awaiting guardian confirmation.', authorId: ana.uid, lifetreeId: ids.treeAna,
      wateringConfirmedBy: 'pending', wateringConfirmation: { note: 'grove', confidence: 0 },
    }, { lastCaredAt: serverTimestamp(), 'watering.lastWateredAt': Timestamp.now(), 'watering.overdue': false });

    await waitFor(async () => (await getDoc(doc(bakr.db, 'pulses', ids.wateringPulse))).data(), 'watering pulse');
    await httpsCallable(bakr.fns, 'witnessWatering')({ pulseId: ids.wateringPulse });

    const pulse = (await getDoc(doc(ana.db, 'pulses', ids.wateringPulse))).data() as any;
    expect(pulse.wateringConfirmedBy).toBe('guardian');
    // The sun ring: a carer ray for Ana and a witness seventh for Bakr — server-minted only.
    const rays = await adminDbA().collection('rays').get();
    const holders = rays.docs.map(d => (d.data() as any).holderUid).sort();
    expect(holders).toEqual([ana.uid, bakr.uid].sort());
    for (const d of rays.docs) expect(d.id.startsWith(`${ids.treeAna}__`)).toBe(true);
  });

  it('a reach crosses, a reply answers, a retraction marks without erasing', async () => {
    ids.reachThreadId = buildThreadId(ana.uid, ids.treeBakr);
    const reachRef = doc(collection(ana.db, 'pulses'));
    const mintedAt = Date.now();
    await setDoc(reachRef, {
      lid: uuidv7(mintedAt), id: reachRef.id, type: 'reach', title: 'Reach', content: 'Salaam, Sycamore.',
      authorId: ana.uid, recipientUid: bakr.uid, participantUids: [ana.uid, bakr.uid],
      threadId: ids.reachThreadId, reachTreeId: ids.treeBakr, domain: DOMAIN, visibility: 'private',
      mintedAt, previousHash: 'PERSON_REACH', hash: await createBlock('PERSON_REACH', { c: 'salaam' }, mintedAt),
      createdAt: serverTimestamp(), loveCount: 0, commentCount: 0, seenBy: [],
    });
    ids.reachMsg = reachRef.id;

    const replyRef = doc(collection(bakr.db, 'pulses'));
    const rAt = Date.now();
    await setDoc(replyRef, {
      lid: uuidv7(rAt), id: replyRef.id, type: 'reach', title: 'Reach', content: 'And with you, Olive.',
      authorId: bakr.uid, recipientUid: ana.uid, participantUids: [ana.uid, bakr.uid],
      threadId: ids.reachThreadId, domain: DOMAIN, visibility: 'private',
      mintedAt: rAt, previousHash: 'PERSON_REACH', hash: await createBlock('PERSON_REACH', { c: 'wa' }, rAt),
      createdAt: serverTimestamp(), loveCount: 0, commentCount: 0, seenBy: [],
    });

    // The author's way out is the MARK, never the erasure (rules overlay h).
    await updateDoc(doc(ana.db, 'pulses', ids.reachMsg), { retractedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    const thread = await getDocs(query(collection(ana.db, 'pulses'),
      where('participantUids', 'array-contains', ana.uid), where('type', '==', 'reach')));
    expect(thread.docs.length).toBe(2);
    expect((thread.docs.find(d => d.id === ids.reachMsg)!.data() as any).retractedAt).toBeTruthy();
  });

  it('a vision is born with its own chain; a contribution grows it; a being joins it', async () => {
    const genesisHash = await createBlock('0', { msg: 'Birth' }, Date.now());
    const vRef = doc(collection(ana.db, 'visions'));
    await setDoc(vRef, {
      lid: uuidv7(), authorId: ana.uid, title: 'One forest, many nodes',
      body: 'That the pattern spreads at the speed of care.', domain: DOMAIN, visibility: 'public',
      genesisHash, latestHash: genesisHash, blockHeight: 0, loveCount: 0, createdAt: serverTimestamp(),
    });
    ids.vision = vRef.id;

    await setDoc(doc(chen.db, 'links', linkId(chen.uid, 'joined', ids.vision)), {
      lid: uuidv7(), type: 'link', rel: 'joined', from: chen.uid, to: ids.vision, createdAt: serverTimestamp(),
    });

    const cRef = doc(collection(ana.db, 'pulses'));
    await runTransaction(ana.db, async (t) => {
      const v = (await t.get(doc(ana.db, 'visions', ids.vision))).data() as any;
      const mintedAt = Date.now();
      const hash = await createBlock(v.latestHash, { title: 'First contribution' }, mintedAt);
      t.set(cRef, {
        lid: uuidv7(mintedAt), id: cRef.id, type: 'vision_growth', title: 'First contribution',
        body: 'A second node is a promise kept.', visionId: ids.vision, authorId: ana.uid,
        domain: DOMAIN, visibility: 'public', mintedAt, previousHash: v.latestHash, hash,
        createdAt: serverTimestamp(), loveCount: 0, commentCount: 0,
      });
      t.update(doc(ana.db, 'visions', ids.vision), { latestHash: hash, blockHeight: (v.blockHeight || 0) + 1 });
    });
    expect(((await getDoc(doc(ana.db, 'visions', ids.vision))).data() as any).blockHeight).toBe(1);
  });

  it('a community forms; the door is knocked, opened, and stepped through', async () => {
    const cRef = doc(collection(ana.db, 'communities'));
    await setDoc(cRef, {
      lid: uuidv7(), ownerId: ana.uid, name: 'Grove Circle', domain: 'grove.demo',
      door: 'invite', visibility: 'public', loveCount: 0, createdAt: serverTimestamp(),
    });
    ids.community = cRef.id;

    // Chen knocks; the keeper opens; the knock dissolves.
    await setDoc(doc(chen.db, 'links', linkId(chen.uid, 'join_request', ids.community)), {
      lid: uuidv7(), type: 'link', rel: 'join_request', from: chen.uid, to: ids.community, createdAt: serverTimestamp(),
    });
    await setDoc(doc(ana.db, 'links', linkId(chen.uid, 'member', ids.community)), {
      lid: uuidv7(), type: 'link', rel: 'member', from: chen.uid, to: ids.community, createdAt: serverTimestamp(),
    });
    await deleteDoc(doc(ana.db, 'links', linkId(chen.uid, 'join_request', ids.community)));

    // The door opens; Bakr steps in by his own hand.
    await updateDoc(doc(ana.db, 'communities', ids.community), { door: 'open', updatedAt: serverTimestamp() });
    await setDoc(doc(bakr.db, 'links', linkId(bakr.uid, 'member', ids.community)), {
      lid: uuidv7(), type: 'link', rel: 'member', from: bakr.uid, to: ids.community, createdAt: serverTimestamp(),
    });
  });

  it('the tree circle grows through the REAL acceptTreeInvite callable', async () => {
    const invRef = doc(collection(ana.db, 'treeOwnershipInvites'));
    await setDoc(invRef, {
      lifetreeId: ids.treeAna, lifetreeName: "Ana's Olive", invitedByUserId: ana.uid,
      invitedUserId: chen.uid, role: 'co_owner', status: 'pending', createdAt: serverTimestamp(),
    });
    ids.treeInvite = invRef.id;
    await httpsCallable(chen.fns, 'acceptTreeInvite')({ inviteId: ids.treeInvite });

    expect((await adminDbA().doc(`links/${chen.uid}__co_owner__${ids.treeAna}`).get()).exists).toBe(true);
    const tree = (await getDoc(doc(ana.db, 'lifetrees', ids.treeAna))).data() as any;
    expect(tree.communityId).toBeTruthy(); // the circle community, server-born
  });

  it('keeping becomes a circle: offer, knock, both server-minted; the anchor resigns', async () => {
    // Offer to Chen; Chen consents through the callable (living-tree proof runs server-side).
    const kRef = doc(collection(ana.db, 'communityKeeperInvites'));
    await setDoc(kRef, {
      communityId: ids.community, communityName: 'Grove Circle',
      invitedUserId: chen.uid, invitedByUserId: ana.uid, status: 'pending', createdAt: serverTimestamp(),
    });
    ids.keeperInvite = kRef.id;
    await httpsCallable(chen.fns, 'acceptKeeperInvite')({ inviteId: ids.keeperInvite });
    expect((await adminDbA().doc(`links/${chen.uid}__keeper__${ids.community}`).get()).exists).toBe(true);

    // Bakr knocks; a sitting keeper answers.
    await setDoc(doc(bakr.db, 'links', linkId(bakr.uid, 'keeper_request', ids.community)), {
      lid: uuidv7(), type: 'link', rel: 'keeper_request', from: bakr.uid, to: ids.community, createdAt: serverTimestamp(),
    });
    await httpsCallable(chen.fns, 'acceptKeeperRequest')({ communityId: ids.community, requesterUid: bakr.uid });

    // The anchor resigns; the longest-standing keeper inherits; never keeperless.
    const res = (await httpsCallable(ana.fns, 'resignKeeper')({ communityId: ids.community })).data as any;
    expect(res.successor).toBe(chen.uid);
    expect(((await getDoc(doc(chen.db, 'communities', ids.community))).data() as any).ownerId).toBe(chen.uid);
    expect((await adminDbA().doc(`links/${bakr.uid}__keeper__${ids.community}`).get()).exists).toBe(true);
  });

  it('a light house is consecrated, rooted in a mother tree; a bed hosts a REAL stay', async () => {
    const lhRef = doc(collection(ana.db, 'lightHouses'));
    await setDoc(lhRef, {
      lid: uuidv7(), ownerId: ana.uid, name: 'The First Hearth', visibility: 'public',
      loveCount: 0, createdAt: serverTimestamp(),
    });
    ids.lightHouse = lhRef.id;
    await setDoc(doc(ana.db, 'links', linkId(ids.lightHouse, 'rooted', ids.treeAna)), {
      lid: uuidv7(), type: 'link', rel: 'rooted', from: ids.lightHouse, to: ids.treeAna, createdAt: serverTimestamp(),
    });

    // A housed bed — born domainless (the structural forest-exclusion invariant).
    const bedRef = doc(collection(ana.db, 'lifetrees'));
    const bedGenesis = await createBlock('0', { msg: 'Birth' }, Date.now());
    await setDoc(bedRef, {
      lid: uuidv7(), ownerId: ana.uid, name: 'Cedar Bed', domain: '', lightHouseId: ids.lightHouse,
      treeType: 'BED', visibility: 'node', createdAt: serverTimestamp(),
      genesisHash: bedGenesis, latestHash: bedGenesis, blockHeight: 0,
      validated: false, validatorId: null, status: 'HEALTHY', loveCount: 0,
    });
    ids.bed = bedRef.id;

    const stayRef = doc(collection(chen.db, 'stays'));
    await setDoc(stayRef, {
      bedId: ids.bed, uid: chen.uid, hostUid: ana.uid, lightHouseId: ids.lightHouse,
      fromDate: '2026-09-01', toDate: '2026-09-03', status: 'requested', createdAt: serverTimestamp(),
    });
    ids.stay = stayRef.id;
    await updateDoc(doc(ana.db, 'stays', ids.stay), { status: 'accepted', updatedAt: serverTimestamp() });

    // The REAL onStayWritten trigger publishes identity-free occupancy.
    const occ = await waitFor(async () => (await adminDbA().doc(`lifetrees/${ids.bed}/occupancy/${ids.stay}`).get()).data(), 'occupancy');
    expect(occ).toEqual({ fromDate: '2026-09-01', toDate: '2026-09-03' });
  });

  it('an event stands on its own root', async () => {
    const eRef = doc(collection(bakr.db, 'pulses'));
    const eAt = Date.now();
    await setDoc(eRef, {
      lid: uuidv7(eAt), id: eRef.id, type: 'event', title: 'Grove Gathering',
      body: 'Under the first hearth.', eventDate: '2026-09-20T12:00', eventLocation: 'The Grove',
      authorId: bakr.uid, domain: DOMAIN, visibility: 'public',
      mintedAt: eAt, previousHash: 'EVENT', hash: await createBlock('EVENT', { t: 'gather' }, eAt),
      createdAt: serverTimestamp(), loveCount: 0, commentCount: 0,
    });
    ids.event = eRef.id;
  });

  const love = (p: Persona, treeId: string) => runTransaction(p.db, async (t) => {
    const parent = doc(p.db, 'lifetrees', treeId);
    const snap = await t.get(parent);
    const before = (snap.data() as any).loveCount || 0;
    t.set(doc(parent, 'loves', p.uid), { uid: p.uid, createdAt: serverTimestamp() });
    t.update(parent, { loveCount: before + 1, updatedAt: serverTimestamp() });
  });

  it('a single love lands: the slot and the tally move as one', async () => {
    await love(ana, ids.treeBakr);
    expect(((await getDoc(doc(bakr.db, 'lifetrees', ids.treeBakr))).data() as any).loveCount).toBe(1);
  });

  // Two clients racing one document: the EMULATOR surfaces the write conflict as a bare
  // PERMISSION_DENIED instead of letting the losing transaction retry (found here
  // 2026-08-15) — so the parallel case runs on distinct beings. The slot+tally coupling
  // law itself is proven by the rules suite; the same-doc race is an emulator behavior,
  // recorded so the next reader doesn't rediscover it the hard way.
  it('parallel loves on distinct beings hold their arithmetic', async () => {
    await Promise.all([love(chen, ids.treeBakr), love(bakr, ids.treeChen)]);
    expect(((await getDoc(doc(bakr.db, 'lifetrees', ids.treeBakr))).data() as any).loveCount).toBe(2);
    expect(((await getDoc(doc(chen.db, 'lifetrees', ids.treeChen))).data() as any).loveCount).toBe(1);
  });

  it('the assembled surfaces tell the truth: the forest holds trees, never beds', async () => {
    const forest = await getDocs(query(collection(ana.db, 'lifetrees'),
      where('domain', '==', DOMAIN), where('visibility', 'in', ['public', 'node'])));
    const names = forest.docs.map(d => (d.data() as any).name).sort();
    expect(names).toContain("Ana's Olive");
    expect(names).toContain("Chen's Willow");
    expect(names).not.toContain('Cedar Bed'); // domainless by construction — structurally invisible
  });
});

// ── The Crossing ────────────────────────────────────────────────────────────────────────
const SUBCOLLECTIONS = ['loves', 'occupancy', 'signatures', 'keys', 'keyEvents', 'keyRecoveries', 'witnesses'];

const gatherNode = async (db: FirebaseFirestore.Firestore): Promise<BundleDoc[]> => {
  const docs: BundleDoc[] = [];
  const tops = [...new Set(TRAVEL_PLAN.filter(r => !r.path.includes('*') && r.path.split('/').length === 1 && r.mode !== 'excluded').map(r => r.path))];
  for (const top of tops) {
    for (const d of (await db.collection(top).get()).docs) {
      const rule = travelRuleFor(d.ref.path);
      if (rule && rule.mode !== 'excluded') docs.push({ path: d.ref.path, data: d.data() as Record<string, unknown> });
    }
  }
  for (const sub of SUBCOLLECTIONS) {
    for (const d of (await db.collectionGroup(sub).get()).docs) {
      const rule = travelRuleFor(d.ref.path);
      if (rule && rule.mode !== 'excluded') docs.push({ path: d.ref.path, data: d.data() as Record<string, unknown> });
    }
  }
  return docs;
};

describe('the Crossing — the lived world travels to a second database and survives', () => {
  let bundle: NodeBundle;
  // The custodian's REAL Ed25519 hand (services/signingCrypto — the production rail), and
  // the anchor as node 2 would hold it: resolved from the initiations ledger / its own
  // pinned config, NEVER from inside the bundle.
  let custodian: Awaited<ReturnType<typeof keypairFromSeed>>;
  let anchor: BundleSealAnchor;

  it('the export bundles the Grove under the charter head, and the law verifies it', async () => {
    const docs = await gatherNode(adminDbA());
    expect(docs.length).toBeGreaterThan(25); // a lived world, not an empty room
    for (const d of docs) expect(travelRuleFor(d.path), `unplanned path ${d.path}`).toBeTruthy();

    const head: CharterHead = {
      formatVersion: BUNDLE_FORMAT_VERSION,
      nodeLid: NODE_LID,
      domain: DOMAIN,
      exportedAtMs: Date.now(),
      exportCommit: 'grove-demo',
      charterHashes: {
        genesisMd: await sha256(readFileSync(join(__dirname, '..', '..', 'root', 'GENESIS.md'), 'utf8')),
        linMd: await sha256(readFileSync(join(__dirname, '..', '..', 'root', 'LIN.md'), 'utf8')),
      },
      genesisTree: null,
      census: await buildCensus(docs),
    };
    bundle = { head, manifestHash: await manifestHashOf(head), docs };

    // THE CEREMONY: the custodian signs the manifest hash — one human hand, ~100 bytes,
    // the only line of the bundle that cannot be recomputed by a stranger.
    custodian = await keypairFromSeed(generateSeed());
    anchor = { fingerprint: await sha256(custodian.publicKeyB64), publicKeyB64: custodian.publicKeyB64 };
    bundle.seal = {
      fingerprint: anchor.fingerprint,
      signature: await signPayload(custodian.privateKey, bundle.manifestHash, BUNDLE_SEAL_TAG),
    };
    expect(await verifyBundleSeal(bundle, anchor, verifyPayload)).toBeNull();

    const verdict = await verifyBundle(bundle);
    expect(verdict.issues).toEqual([]);
    expect(beingsIndexIssues(docs)).toEqual([]);      // the map agrees with the territory
    expect(chainClosureIssues(docs)).toEqual([]);     // no chain severed
    expect(localUidCensus(docs)).toEqual([ana.uid, bakr.uid, chen.uid].sort()); // every mortal name, none extra
  });

  it('tampering, filtering, and smuggling are each refused by name', async () => {
    const tampered: NodeBundle = { ...bundle, docs: bundle.docs.map(d => d.path === `lifetrees/${ids.treeAna}` ? { ...d, data: { ...d.data, name: 'Rewritten Olive' } } : d) };
    expect((await verifyBundle(tampered)).issues.map(i => i.code)).toContain('census_digest');

    // Severing the ROOTS: with every head doc gone, no genesisHash is carried and each
    // chained block points at nothing. (Removing ONE tree is not deterministic here — the
    // Grove planted three trees in the same millisecond and they share a genesis hash:
    // createBlock('0', {msg:'Birth'}, sameMs). True in production too; noted in the law.)
    const filtered = bundle.docs.filter(d => collectionSignature(d.path) === 'pulses');
    expect(chainClosureIssues(filtered).map(i => i.code)).toContain('chain_break');

    const smuggled: NodeBundle = { ...bundle, docs: [...bundle.docs, { path: 'providerCredentials/global_x_anthropic', data: { key: 'sk-leak' } }] };
    expect((await verifyBundle(smuggled)).issues.map(i => i.code)).toContain('plan_violation');
  });

  it('node 2 refuses the unsealed bundle, and the stranger\'s — however consistent', async () => {
    // Internally flawless, no seal: consistency is not provenance.
    expect(await verifyBundleSeal({ ...bundle, seal: undefined }, anchor, verifyPayload)).toBe('seal_missing');

    // A stranger with the WHOLE data set mints a perfectly consistent bundle and signs it
    // with their own real key — refused at the anchor, before any cryptography runs.
    const stranger = await keypairFromSeed(generateSeed());
    const strangers: NodeBundle = {
      ...bundle,
      seal: {
        fingerprint: await sha256(stranger.publicKeyB64),
        signature: await signPayload(stranger.privateKey, bundle.manifestHash, BUNDLE_SEAL_TAG),
      },
    };
    expect((await verifyBundle(strangers)).issues).toEqual([]); // flawless inside…
    expect(await verifyBundleSeal(strangers, anchor, verifyPayload)).toBe('seal_key_unanchored'); // …refused outside

    // The stranger claims the custodian's fingerprint over their own signature: the
    // cryptography itself refuses.
    expect(await verifyBundleSeal(
      { ...bundle, seal: { fingerprint: anchor.fingerprint, signature: strangers.seal!.signature } },
      anchor, verifyPayload,
    )).toBe('seal_invalid');

    // A covenant-tagged signature over the same hash can never seal a bundle (domain-tag
    // discipline): sign with the custodian's true key under a FOREIGN tag.
    expect(await verifyBundleSeal(
      { ...bundle, seal: { fingerprint: anchor.fingerprint, signature: await signPayload(custodian.privateKey, bundle.manifestHash, 'lightseed.covenant.v2') } },
      anchor, verifyPayload,
    )).toBe('seal_invalid');
  });

  it('the restore lands on the far shore; the census, chains, index and custody all hold', async () => {
    // THE GATE: no seal, no shore. The far side verifies the custodian's hand against its
    // out-of-band anchor before a single document lands.
    expect(await verifyBundleSeal(bundle, anchor, verifyPayload)).toBeNull();
    const dbB = adminDbB();
    // Verbatim docs travel byte-for-byte; the beings index is REBUILT, never imported.
    let batch = dbB.batch(); let n = 0;
    for (const d of bundle.docs) {
      if (travelRuleFor(d.path)!.mode !== 'verbatim') continue;
      batch.set(dbB.doc(d.path), d.data);
      if (++n % 400 === 0) { await batch.commit(); batch = dbB.batch(); }
    }
    for (const e of expectedBeingsIndex(bundle.docs)) {
      batch.set(dbB.doc(`beings/${e.lid}`), { ...e, recordedAt: new Date() });
      if (++n % 400 === 0) { await batch.commit(); batch = dbB.batch(); }
    }
    await batch.commit();

    // Re-read the far shore and hold it against the manifest, verbatim collection by collection.
    const restored = await gatherNode(dbB);
    const restoredCensus = await buildCensus(restored.filter(d => travelRuleFor(d.path)!.mode === 'verbatim'));
    const claimed = new Map(bundle.head.census.map(c => [c.path, c]));
    for (const c of restoredCensus) {
      const want = claimed.get(c.path)!;
      expect(c.count, `count of ${c.path}`).toBe(want.count);
      expect(c.digest, `digest of ${c.path} — a byte changed in the water`).toBe(want.digest);
    }
    expect(chainClosureIssues(restored)).toEqual([]);
    expect(beingsIndexIssues(restored)).toEqual([]);

    // One being, hash-identical on both shores.
    const anaTreeB = restored.find(d => d.path === `lifetrees/${ids.treeAna}`)!;
    const anaTreeA = bundle.docs.find(d => d.path === `lifetrees/${ids.treeAna}`)!;
    expect(await docContentHash(anaTreeB)).toBe(await docContentHash(anaTreeA));

    // Custody is re-SWORN, never copied: the far shore declares with the head's nodeLid.
    await dbB.doc('config/dataAuthority').set({ version: 1, nodeLid: bundle.head.nodeLid, declaredAt: new Date() });
    const authority = dataAuthorityOf((await dbB.doc('config/dataAuthority').get()).data());
    expect(authority?.nodeLid).toBe(NODE_LID);
  });
});
