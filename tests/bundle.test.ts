import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  BUNDLE_FORMAT_VERSION, TRAVEL_PLAN, NON_CHAIN_ROOTS, travelRuleFor, collectionSignature,
  BUNDLE_SEAL_TAG, verifyBundleSeal,
  linkFromIsUid, docContentHash, buildCensus, manifestHashOf, verifyBundle,
  chainClosureIssues, beingsIndexIssues, localUidCensus,
  type BundleDoc, type CharterHead, type NodeBundle,
} from '../src/domain/bundle';

// The bundle law (ring 2026-08-15): what travels, what is rebuilt, what is re-sworn, what
// stays behind — and the proof that no collection can be silently forgotten. The two mirror
// tests here are the teeth: the travel plan is held against every match block in
// firestore.rules, and the chain-root sentinels against the services that mint them.

const LID_A = '019f6381-48fd-7fcc-9382-e99d923f38f4'; // the Aspen's real lid — known-valid UUIDv7
const LID_B = '019f6381-48fd-7fcc-9382-e99d923f38f5';
const NODE_LID = '019f6381-48fd-7fcc-9382-e99d923f38f6';

describe('the travel plan mirrors the rules — no collection silently forgotten', () => {
  // Parse every `match /…/{…}` path out of firestore.rules, tracking brace depth so nested
  // subcollections compose their full signatures ('lifetrees/*/loves').
  const rulesSignatures = (): Set<string> => {
    const text = readFileSync(join(__dirname, '..', 'firestore.rules'), 'utf8');
    const sigs = new Set<string>();
    const stack: { colls: string[]; depth: number }[] = [];
    let depth = 0;
    for (const raw of text.split('\n')) {
      const line = raw.replace(/\/\/.*$/, '');
      const m = /match\s+(\/[\w/{}=*]+)\s*\{/.exec(line);
      if (m) {
        const colls = m[1].split('/').filter(Boolean).filter(s => !s.startsWith('{'));
        stack.push({ colls, depth });
        const full = stack.flatMap(e => e.colls);
        const docsAt = full.indexOf('documents');
        const inner = docsAt >= 0 ? full.slice(docsAt + 1) : [];
        if (inner.length) sigs.add(inner.join('/*/'));
      }
      // Placeholder braces ({userId}) are balanced within the line and must not count as
      // block depth — strip them before counting, or every match pops itself immediately.
      const structural = line.replace(/\{[^{}]*\}/g, '');
      for (const ch of structural) {
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; while (stack.length && depth <= stack[stack.length - 1].depth) stack.pop(); }
      }
    }
    return sigs;
  };

  // Collections that exist in code but have NO rules block (server-only, default-deny).
  const NO_RULES_BLOCK = new Set(['mailThrottle']);
  // Literal doc-level plan entries fold into their collection's rules block.
  const planSignatures = new Set(
    TRAVEL_PLAN.map(r => r.path.split('/').length % 2 === 0 ? r.path.split('/').slice(0, -1).join('/') : r.path),
  );

  it('every collection the rules know is in the plan', () => {
    const sigs = rulesSignatures();
    // The parser must SEE the rules — below this floor the mirror is vacuous, not green
    // (the first version of this test passed while parsing zero signatures).
    expect(sigs.size).toBeGreaterThan(25);
    expect(sigs.has('lifetrees/*/loves')).toBe(true); // nesting composes
    for (const sig of sigs) {
      expect(planSignatures.has(sig), `firestore.rules matches '${sig}' but the travel plan never mentions it — a bundle would silently lose it`).toBe(true);
    }
  });

  it('every plan entry is a collection the rules know (or a named no-rules exception)', () => {
    const sigs = rulesSignatures();
    for (const sig of planSignatures) {
      expect(sigs.has(sig) || NO_RULES_BLOCK.has(sig), `the travel plan names '${sig}' but firestore.rules has no such match — plan drift`).toBe(true);
    }
  });

  it('every witness and every exclusion says why, out loud', () => {
    for (const r of TRAVEL_PLAN) {
      if (r.mode !== 'verbatim') expect(r.reason?.trim().length ?? 0, `${r.path} (${r.mode}) carries no reason`).toBeGreaterThan(10);
    }
  });

  it('the secrets never travel; custody is never copied', () => {
    expect(travelRuleFor('providerCredentials/global_x_anthropic')?.mode).toBe('excluded');
    expect(travelRuleFor('config/dataAuthority')?.mode).toBe('excluded');
    expect(travelRuleFor('config/limits')?.mode).toBe('verbatim'); // the literal rule wins only for its own doc
  });
});

describe('the chain-root sentinels mirror the services that mint them', () => {
  it('every previousHash sentinel in the services is a known non-chain root', () => {
    // EVERY service file — the first version scanned two and missed watering.ts's
    // WATER_ALERT sentinel (found live by the ghost healer, 2026-08-17).
    const dir = join(__dirname, '..', 'src', 'services', 'firebase');
    const services = readdirSync(dir).filter(f => f.endsWith('.ts'))
      .map(f => readFileSync(join(dir, f), 'utf8'))
      .join('\n');
    const found = new Set<string>();
    for (const m of services.matchAll(/previousHash:\s*'([A-Z_]+)'/g)) found.add(m[1]);
    for (const m of services.matchAll(/const PERSON_REACH_SENTINEL = '([A-Z_]+)'/g)) found.add(m[1]);
    expect(found.size).toBeGreaterThan(0);
    for (const s of found) {
      expect(NON_CHAIN_ROOTS.has(s), `services mint previousHash '${s}' but the bundle law would flag it as a chain break`).toBe(true);
    }
  });
});

describe('doc hashes and the census', () => {
  const doc = (path: string, data: Record<string, unknown>): BundleDoc => ({ path, data });

  it('hashing is canonical: key order never matters, the path always does', async () => {
    const a = await docContentHash(doc('lifetrees/x', { name: 'Oak', ownerId: 'u1' }));
    const b = await docContentHash(doc('lifetrees/x', { ownerId: 'u1', name: 'Oak' }));
    const c = await docContentHash(doc('lifetrees/y', { name: 'Oak', ownerId: 'u1' }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('a | in a doc id cannot shift the path/data boundary (the separator attack)', async () => {
    // Without JSON-quoting the path, these two could craft one preimage.
    const a = await docContentHash(doc('subscriptions/a|b', { n: 1 }));
    const b = await docContentHash(doc('subscriptions/a', { 'b|n': 1 }));
    expect(a).not.toBe(b);
  });

  it('stamps hash by their milliseconds, whatever object carries them', async () => {
    const s1 = { toMillis: () => 1755000000000 };
    const s2 = { toMillis: () => 1755000000000, extra: 'ignored by canonicalize' };
    expect(await docContentHash(doc('pulses/p', { createdAt: s1 })))
      .toBe(await docContentHash(doc('pulses/p', { createdAt: s2 })));
  });

  it('the census is order-free and tamper-evident', async () => {
    const docs = [doc('lifetrees/a', { n: 1 }), doc('lifetrees/b', { n: 2 }), doc('visions/v', { n: 3 })];
    const straight = await buildCensus(docs);
    const shuffled = await buildCensus([docs[2], docs[0], docs[1]]);
    expect(straight).toEqual(shuffled);
    const tampered = await buildCensus([doc('lifetrees/a', { n: 999 }), docs[1], docs[2]]);
    expect(tampered.find(c => c.path === 'lifetrees')!.digest)
      .not.toBe(straight.find(c => c.path === 'lifetrees')!.digest);
  });
});

describe('verifyBundle — the whole structural verdict', () => {
  const mkBundle = async (docs: BundleDoc[], mutate?: (head: CharterHead) => void): Promise<NodeBundle> => {
    const head: CharterHead = {
      formatVersion: BUNDLE_FORMAT_VERSION,
      nodeLid: NODE_LID,
      domain: 'lightseed.online',
      exportedAtMs: 1755000000000,
      exportCommit: 'abc1234',
      charterHashes: { genesisMd: 'g'.repeat(64), linMd: 'l'.repeat(64) },
      genesisTree: null,
      census: await buildCensus(docs),
    };
    mutate?.(head);
    return { head, manifestHash: await manifestHashOf(head), docs };
  };

  const docs = [
    { path: 'lifetrees/t1', data: { lid: LID_A, ownerId: 'u1', name: 'Oak' } },
    { path: 'lifetrees/t1/loves/u2', data: { uid: 'u2' } },
    { path: 'links/u2__guardian__t1', data: { rel: 'guardian', from: 'u2', to: 't1' } },
  ];

  it('a whole bundle passes', async () => {
    expect((await verifyBundle(await mkBundle(docs))).ok).toBe(true);
  });

  it('a tampered doc breaks its census digest', async () => {
    const bundle = await mkBundle(docs);
    bundle.docs[0].data.name = 'Rewritten';
    const v = await verifyBundle(bundle);
    expect(v.issues.map(i => i.code)).toContain('census_digest');
  });

  it('a smuggled secret is a violation, not a bonus', async () => {
    const smuggled = [...docs, { path: 'providerCredentials/global_x_anthropic', data: { key: 'sk-…' } }];
    const v = await verifyBundle(await mkBundle(smuggled));
    expect(v.issues.map(i => i.code)).toContain('plan_violation');
  });

  it('a collection the plan never heard of is named', async () => {
    const v = await verifyBundle(await mkBundle([...docs, { path: 'shadowLedger/x', data: {} }]));
    expect(v.issues.map(i => i.code)).toContain('unknown_collection');
  });

  it('a head altered after sealing is caught', async () => {
    const bundle = await mkBundle(docs);
    bundle.head.domain = 'elsewhere.example';
    const v = await verifyBundle(bundle);
    expect(v.issues.map(i => i.code)).toContain('manifest_mismatch');
  });

  it('a missing doc is a count mismatch; a head claiming ghosts is census_extra', async () => {
    const bundle = await mkBundle(docs);
    bundle.docs = bundle.docs.filter(d => d.path !== 'lifetrees/t1/loves/u2');
    const codes = (await verifyBundle(bundle)).issues.map(i => i.code);
    expect(codes).toContain('census_extra'); // loves census claimed, body empty of it
  });

  it('one path, one doc — a duplicate would restore as less than it censused', async () => {
    const v = await verifyBundle(await mkBundle([...docs, { ...docs[0] }]));
    expect(v.issues.map(i => i.code)).toContain('duplicate_path');
  });

  it('a malformed custody claim is refused', async () => {
    const v = await verifyBundle(await mkBundle(docs, h => { h.nodeLid = 'not-a-lid'; }));
    expect(v.issues.map(i => i.code)).toContain('bad_node_lid');
  });

  it('charter drift: the head and the carried GENESIS_TREE must agree', async () => {
    const g = { path: 'lifetrees/GENESIS_TREE', data: { lid: LID_B, genesisHash: 'aa', latestHash: 'bb', blockHeight: 2 } };
    const v = await verifyBundle(await mkBundle([...docs, g], h => {
      h.genesisTree = { docId: 'GENESIS_TREE', lid: LID_B, genesisHash: 'aa', latestHash: 'DRIFTED', blockHeight: 2 };
    }));
    expect(v.issues.map(i => i.code)).toContain('charter_drift');
  });
});

describe('chain closure — a filtered export is loud, sentinels are quiet', () => {
  const tree = { path: 'lifetrees/t1', data: { lid: LID_A, genesisHash: 'g0' } };
  const b1 = { path: 'pulses/p1', data: { hash: 'h1', previousHash: 'g0', lifetreeId: 't1' } };
  const b2 = { path: 'pulses/p2', data: { hash: 'h2', previousHash: 'h1', lifetreeId: 't1' } };
  const reach = { path: 'pulses/r1', data: { hash: 'hr', previousHash: 'PERSON_REACH' } };

  it('a whole chain and a sentinel root both pass', () => {
    expect(chainClosureIssues([tree, b1, b2, reach])).toEqual([]);
  });

  it('dropping a middle block severs everything after it — and the law says so', () => {
    const issues = chainClosureIssues([tree, b2, reach]);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('chain_break');
    expect(issues[0].path).toBe('pulses/p2');
  });
});

describe('the beings index is rebuilt, never trusted', () => {
  const body = [
    { path: 'lifetrees/t1', data: { lid: LID_A } },
    { path: 'users/u1', data: { lid: LID_B } },
  ];

  it('a witness that agrees is silent', () => {
    const witness = [
      { path: `beings/${LID_A}`, data: { lid: LID_A, kind: 'tree', collection: 'lifetrees', docId: 't1' } },
      { path: `beings/${LID_B}`, data: { lid: LID_B, kind: 'person', collection: 'users', docId: 'u1' } },
    ];
    expect(beingsIndexIssues([...body, ...witness])).toEqual([]);
  });

  it('a missing entry and a disagreeing address are both named', () => {
    const witness = [
      { path: `beings/${LID_A}`, data: { lid: LID_A, kind: 'tree', collection: 'lifetrees', docId: 'OTHER' } },
    ];
    const codes = beingsIndexIssues([...body, ...witness]).map(i => i.code);
    expect(codes).toContain('index_disagrees'); // LID_A points elsewhere
    expect(codes).toContain('index_missing');   // LID_B has no witness at all
  });
});

describe('the re-anchoring census — every mortal uid, none twice, no impostors', () => {
  it('collects marked fields, uid-keyed ids, arrays, and person-edges only', () => {
    const docs: BundleDoc[] = [
      { path: 'lifetrees/t1', data: { ownerId: 'zoltan', validatorId: 'chris' } },
      { path: 'lifetrees/t1/loves/lumo', data: { uid: 'lumo' } },
      { path: 'pulses/p1', data: { authorId: 'zoltan', participantUids: ['zoltan', 'chris'] } },
      { path: 'links/lumo__guardian__t1', data: { rel: 'guardian', from: 'lumo', to: 't1' } },
      { path: 'links/t2__participant__ev1', data: { rel: 'participant', from: 't2', to: 'ev1' } },  // tree id — NOT a uid
      { path: 'links/lh1__rooted__t1', data: { rel: 'rooted', from: 'lh1', to: 't1' } },            // lightHouse id — NOT a uid
      { path: 'persons/aspen/keyRecoveries/r1/witnesses/chris__epoch1', data: {} },                  // composite keeps its uid half
      { path: 'mail/m1', data: { toUids: ['ghost'] } },                                              // excluded — never counted
      { path: 'rays/t1__2026-08-15__witness', data: { holderUid: 'lumo', sourceUid: 'departed' } },  // the tombstone is not a person
    ];
    expect(localUidCensus(docs)).toEqual(['aspen', 'chris', 'lumo', 'zoltan']);
  });

  it('the two non-person edges are exactly participant and rooted/shelters', () => {
    expect(linkFromIsUid('guardian')).toBe(true);
    expect(linkFromIsUid('keeper')).toBe(true);
    expect(linkFromIsUid('participant')).toBe(false);
    expect(linkFromIsUid('rooted')).toBe(false);
    expect(linkFromIsUid('shelters')).toBe(false);
    expect(linkFromIsUid('grows_in')).toBe(false);
    expect(linkFromIsUid('collaborates_with')).toBe(false);
    expect(linkFromIsUid('recognises')).toBe(false);
    expect(linkFromIsUid('shares_resources_with')).toBe(false);
  });
});

describe('path matching', () => {
  it('signatures compose through nesting; literal doc rules win their one doc', () => {
    expect(collectionSignature('persons/u1/keyRecoveries/r1/witnesses/w__e')).toBe('persons/*/keyRecoveries/*/witnesses');
    expect(travelRuleFor('lifetrees/t1/loves/u1')?.path).toBe('lifetrees/*/loves');
    expect(travelRuleFor('config/dataAuthority')?.mode).toBe('excluded');
    expect(travelRuleFor('config/superadmin')?.path).toBe('config');
    expect(travelRuleFor('nowhere/x')).toBeNull();
  });
});

describe('the custodian\'s seal — provenance, anchored outside the bundle (ring 2026-08-24)', () => {
  const anchor = { fingerprint: 'fp-custodian', publicKeyB64: 'pub-custodian' };
  // A stub verifier that accepts exactly one (key, sig, payload, tag) tuple — the pure
  // logic is under test here; the real Ed25519 rail is proven in the Crossing.
  const verifierAccepting = (sig: string, payload: string) =>
    async (pub: string, s2: string, p2: unknown, tag: string) =>
      pub === anchor.publicKeyB64 && s2 === sig && p2 === payload && tag === BUNDLE_SEAL_TAG;

  it('an unsealed bundle is named, not trusted', async () => {
    expect(await verifyBundleSeal({ manifestHash: 'm1' }, anchor, verifierAccepting('s', 'm1')))
      .toBe('seal_missing');
  });

  it('a stranger\'s fingerprint is refused before any cryptography runs', async () => {
    expect(await verifyBundleSeal(
      { manifestHash: 'm1', seal: { fingerprint: 'fp-stranger', signature: 'valid-elsewhere' } },
      anchor, verifierAccepting('valid-elsewhere', 'm1'),
    )).toBe('seal_key_unanchored');
  });

  it('a bad signature under the right fingerprint is refused; the true hand passes', async () => {
    expect(await verifyBundleSeal(
      { manifestHash: 'm1', seal: { fingerprint: 'fp-custodian', signature: 'forged' } },
      anchor, verifierAccepting('true-sig', 'm1'),
    )).toBe('seal_invalid');
    expect(await verifyBundleSeal(
      { manifestHash: 'm1', seal: { fingerprint: 'fp-custodian', signature: 'true-sig' } },
      anchor, verifierAccepting('true-sig', 'm1'),
    )).toBeNull();
  });
});
