import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { chainExport, plainify } from '../../src/domain/export';
import { isDomainVerified, challengeRecordValue, challengeRecordName } from '../../src/domain/domainVerification';

// THE LIGHT PATH, WALKED WHOLE — one story test under the REAL rules, the same enforcement
// every UI hand meets: a being arrives, plants a tree, waters it onto the chain, founds a
// community, claims a domain, asks for the DNS proof (the server hands act exactly where
// the Cloud Functions do), and finally EXPORTS — the archive written to disk like the
// browser download, read back, and compared through the same domain laws the app ships.

let env: RulesTestEnvironment;

const AURORA = 'aurora-uid'; // the being walking the path
const MALLORY = 'mallory-uid';

const db = (uid?: string) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'lifeseed-lightpath-test',
    firestore: { rules: readFileSync(join(__dirname, '..', '..', 'firestore.rules'), 'utf8') },
  });
  await env.clearFirestore();
});
afterAll(async () => { await env.cleanup(); });

describe('the light path, until the anchor is proven — and the being leaves with its data', () => {
  const TREE = 'aurora-tree';
  const COM = 'aurora-com';
  const DOMAIN = 'aurora.earth';

  it('walks every step in order', async () => {
    // 1 · A being arrives (the server ensures the person entity, as ensurePersonEntity does).
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'persons', AURORA), { lid: 'aurora-lid', name: 'Aurora' }));

    // 2 · Plants a tree — the birth is signed (ownerId must be the planter's own).
    await assertSucceeds(setDoc(doc(db(AURORA), 'lifetrees', TREE), {
      ownerId: AURORA, name: 'Dawn Cedar', treeType: 'LIFETREE', visibility: 'public',
      validated: false, validatorId: null, loveCount: 0, createdAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(db(MALLORY), 'lifetrees', 'forged'), {
      ownerId: AURORA, name: 'Forged', loveCount: 0,
    }));

    // 3 · Waters it onto the chain — two sealed leaves, each the carer's own hand.
    await assertSucceeds(setDoc(doc(db(AURORA), 'pulses', 'w1'), {
      authorId: AURORA, type: 'growth', care: 'watering', lifetreeId: TREE,
      hash: 'h1', previousHash: '0', blockHeight: 1, visibility: 'public',
      createdAt: serverTimestamp(),
    }));
    await assertSucceeds(setDoc(doc(db(AURORA), 'pulses', 'w2'), {
      authorId: AURORA, type: 'growth', care: 'watering', lifetreeId: TREE,
      hash: 'h2', previousHash: 'h1', blockHeight: 2, visibility: 'public',
      createdAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(db(MALLORY), 'pulses', 'wx'), {
      authorId: MALLORY, type: 'growth', care: 'watering', lifetreeId: TREE,
      hash: 'hx', previousHash: 'h2', blockHeight: 3,
    })); // not a carer — the chain refuses a stranger's water
    await assertSucceeds(updateDoc(doc(db(AURORA), 'lifetrees', TREE), {
      latestHash: 'h2', blockHeight: 2, updatedAt: serverTimestamp(),
    }));

    // 4 · Founds a community, in her own name.
    await assertSucceeds(setDoc(doc(db(AURORA), 'communities', COM), {
      ownerId: AURORA, name: 'Aurora Commons', domain: '', vision: '', imageUrls: [],
      loveCount: 0, createdAt: serverTimestamp(),
    }));

    // 5 · Claims a domain — self-declared, an anchor without proof yet.
    await assertSucceeds(updateDoc(doc(db(AURORA), 'communities', COM), { domain: DOMAIN }));

    // 6 · Asks for the proof. The SERVER mints the challenge (startDomainVerification's
    //     hand); no client may read, forge, or pre-claim the mark.
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'domainChallenges', COM), {
        communityId: COM, domain: DOMAIN, token: 'f'.repeat(32),
        createdBy: AURORA, createdAt: serverTimestamp(), usedAt: null,
      }));
    await assertFails(getDoc(doc(db(AURORA), 'domainChallenges', COM)));
    await assertFails(updateDoc(doc(db(AURORA), 'communities', COM), {
      domainVerification: { domain: DOMAIN, method: 'dns_txt' },
    }));

    // The record she would plant at her DNS host — the laws name it exactly.
    expect(challengeRecordName(DOMAIN)).toBe('_lightseed-challenge.aurora.earth');
    expect(challengeRecordValue('f'.repeat(32))).toBe(`lightseed-verification=v1:${'f'.repeat(32)}`);

    // 7 · The server OBSERVES the TXT record (checkDomainVerification's hand): the mark
    //     lands on the community, the spent token is deleted — residue, not record.
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await updateDoc(doc(d, 'communities', COM), {
        domainVerification: { domain: DOMAIN, method: 'dns_txt', verifiedAt: serverTimestamp() },
      });
      await deleteDoc(doc(d, 'domainChallenges', COM));
    });
    // The spent token is residue: gone from the server's sight, refused to every client's.
    await env.withSecurityRulesDisabled(async (ctx) =>
      expect((await getDoc(doc(ctx.firestore(), 'domainChallenges', COM))).exists()).toBe(false));
    await assertFails(getDoc(doc(db(AURORA), 'domainChallenges', COM)));

    // 8 · THE EXPORT — gathered with Aurora's own sight (every read below is her hand).
    const her = db(AURORA);
    const tree = (await getDoc(doc(her, 'lifetrees', TREE))).data()!;
    const community = (await getDoc(doc(her, 'communities', COM))).data()!;
    const chainPulses = (await getDocs(query(
      collection(her, 'pulses'), where('lifetreeId', '==', TREE), where('visibility', 'in', ['public', 'node'])))).docs
      .map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));

    const chain = chainExport(chainPulses as { hash?: string; previousHash?: string; blockHeight?: number }[]);
    const archive = plainify({ person: { uid: AURORA }, tree, chain, community }) as Record<string, any>;

    // The download: written to disk as the browser would hand it over…
    const file = join(tmpdir(), 'lightpath-export.json');
    writeFileSync(file, JSON.stringify(archive, null, 2));
    // …and read back cold, compared through the same laws the app ships.
    const reread = JSON.parse(readFileSync(file, 'utf8'));

    expect(reread).toEqual(archive);                               // the download carries the whole truth
    expect(reread.tree.name).toBe('Dawn Cedar');
    expect(reread.tree.latestHash).toBe('h2');
    expect(typeof reread.tree.createdAt).toBe('string');           // Stamps left as ISO
    expect(reread.chain.linked).toBe(true);                        // the chain leaves unbroken
    expect(reread.chain.breaks).toEqual([]);
    expect(reread.chain.blocks.map((b: any) => b.hash)).toEqual(['h1', 'h2']);
    expect(reread.community.domainVerification.domain).toBe(DOMAIN);
    expect(isDomainVerified(reread.community)).toBe(true);         // the badge law reads the archive too
  });
});
