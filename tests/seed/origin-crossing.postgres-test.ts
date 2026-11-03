// THE ORIGIN LEAVES against real PostgreSQL (ring 2026-11-03): a Firestore soil, read as the Admin SDK
// hands it, becomes a bundle sealed under the origin's own version-1 charter, and lands on an
// independent node through the one crossing — every identity bound first, moments readable by the
// soil's own clock, the ledger naming the origin as the source.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startCluster, type Cluster } from './harness';
import { ownerClient, buildBundle, custodianOf, sealBundle, cross } from '../../seed/api/bundle.mjs';
import { originSnapshot, originIdentities, type OriginReader, type OriginRecord } from '../../src/domain/originBundle';

let cluster: Cluster;
beforeAll(() => { cluster = startCluster(55449); });
afterAll(() => cluster.stop());

type Json = Record<string, any>;
const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const pem = () => generateKeyPairSync('ed25519').privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
const stamp = (iso: string, micro = 0) => ({ seconds: Math.floor(Date.parse(iso) / 1000), nanoseconds: micro * 1000, toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); } });
const origin = JSON.parse(readFileSync(resolve('src/config/charter.json'), 'utf8'));
const hashes = { genesisMd: '0'.repeat(64), linMd: '1'.repeat(64) };
const commit = 'b'.repeat(40);

const readerOf = (soil: Record<string, Record<string, unknown>>): OriginReader => {
  const records = (): OriginRecord[] => Object.entries(soil).map(([path, data]) => ({ path, data }));
  return {
    roots: async () => [...new Set(Object.keys(soil).map(path => path.split('/')[0]))],
    docs: async name => records().filter(r => r.path.split('/').length === 2 && r.path.startsWith(`${name}/`)),
    group: async name => records().filter(r => { const s = r.path.split('/'); return s.length >= 4 && s[s.length - 2] === name; }),
  };
};

const soil = {
  'users/alice': { lid: LID(1), displayName: 'Alice', createdAt: stamp('2026-01-01T00:00:00Z', 123456) },
  'persons/alice': { uid: 'alice', lid: LID(1), displayName: 'Alice' },
  'users/bob': { lid: LID(2), displayName: 'Bob' },
  'persons/bob': { uid: 'bob', lid: LID(2), displayName: 'Bob' },
  'lifetrees/t1': { lid: LID(11), anchorUid: 'alice', name: 'Nur', treeType: 'LIGHTTREE', visibility: 'public', genesisHash: 'g1', latestHash: 'h1', blockHeight: 1, createdAt: stamp('2026-01-02T00:00:00Z', 5) },
  'lifetrees/t1/loves/bob': { uid: 'bob', at: stamp('2026-03-01T00:00:00Z') },
  'pulses/p1': { lid: LID(21), authorId: 'alice', lifetreeId: 't1', type: 'tree_growth', visibility: 'public', hash: 'h1', previousHash: 'g1', createdAt: stamp('2026-02-01T00:00:00Z') },
  'links/alice__keeper__t1': { lid: LID(61), type: 'link', rel: 'keeper', from: 'alice', to: 't1', createdAt: stamp('2026-01-02T00:00:00Z', 9) },
  'config/superadmin': { uid: 'alice' },
  'config/dataAuthority': { nodeLid: origin.nodeLid },
  [`beings/${LID(1)}`]: { kind: 'person', ref: 'alice' },
  'mail/m1': { to: 'bob' },
};

describe('the origin crosses', () => {
  it('lands a Firestore soil on an independent node once every identity is bound, and remembers the origin', async () => {
    const target = await cluster.fresh(1);
    const dst = ownerClient(target.connection); await dst.connect();
    try {
      const snapshot = await originSnapshot(readerOf(soil));
      expect(snapshot.unknown).toEqual([]); expect(snapshot.unlandable).toEqual([]);
      const custodian = custodianOf(pem());
      const anchor = { fingerprint: custodian.fingerprint, publicKeyB64: custodian.publicKeyB64 };
      const bundle = sealBundle(await buildBundle({ snapshot: snapshot.docs, charter: origin, exportCommit: commit, charterHashes: hashes, withoutAuthority: true }), custodian);
      expect(bundle.head).toMatchObject({ nodeLid: origin.nodeLid, domain: 'lightseed.online' });
      const { identities, ghosts } = originIdentities(bundle.docs);
      expect(ghosts).toEqual([]);
      expect(identities.map(i => i.sourceUid).sort()).toEqual(['alice', 'bob']);

      // Nobody is bound yet: the whole proposal waits.
      let crossing = await cross(dst, { incoming: bundle, anchor, identities, apply: true });
      expect(crossing.applied).toBe(false);
      expect(crossing.plan.issues.map((i: Json) => i.code)).toEqual(['identity_conflict', 'identity_conflict']);
      for (const uid of ['alice', 'bob']) await dst.query("INSERT INTO seed.identity_bindings(issuer,subject,uid,binding_kind) VALUES ('https://issuer.example',$1,$2,'explicit')", [`sub-${uid}`, uid]);
      crossing = await cross(dst, { incoming: bundle, anchor, identities, apply: true });
      expect(crossing.plan.issues).toEqual([]);
      expect(crossing.applied).toBe(true); expect(crossing.inserted).toBe(8); // two users, two persons, the tree, its love, the block, the keeper link

      const landed = async (q: string, values: unknown[] = []) => (await dst.query(q, values)).rows;
      // Moments landed in the soil's own written form, and its clock reads them.
      expect(await landed("SELECT doc->>'createdAt' AS at, ((doc->>'createdAt')::timestamptz AT TIME ZONE 'UTC')::text AS moment FROM lifetrees WHERE id='t1'"))
        .toEqual([{ at: '2026-01-02T00:00:00.000005Z', moment: '2026-01-02 00:00:00.000005' }]);
      expect(await landed("SELECT doc->>'createdAt' AS at FROM users WHERE id='alice'")).toEqual([{ at: '2026-01-01T00:00:00.123456Z' }]);
      expect(await landed("SELECT from_id, rel, to_id, lid, doc, created_at::text FROM links")).toEqual([{ from_id: 'alice', rel: 'keeper', to_id: 't1', lid: LID(61), doc: { type: 'link' }, created_at: expect.stringContaining('2026-01-02') }]);
      expect(await landed('SELECT parent_kind, parent_id, uid, doc FROM loves')).toEqual([{ parent_kind: 'lifetrees', parent_id: 't1', uid: 'bob', doc: { uid: 'bob', at: '2026-03-01T00:00:00.000000Z' } }]);
      expect(await landed('SELECT count(*) FROM config')).toEqual([{ count: '0' }]);
      expect(await landed('SELECT doc FROM seed.crossings')).toEqual([{ doc: expect.objectContaining({ sourceNodeLid: origin.nodeLid, sourceDomain: 'lightseed.online', inserted: 8 }) }]);
      // The runtime role reads what landed as the door would serve it.
      expect(await landed("SELECT count(*) FROM pulses WHERE doc->>'authorId'='alice'")).toEqual([{ count: '1' }]);
    } finally { await dst.end(); await target.db.close(); }
  });
});
