// THE CROSSING against real PostgreSQL (ring 2026-11-02): a node leaves by its travel plan with the
// custodian's seal, and arrives at another by additive merge in one transaction — identical records
// idempotent, a differing record blocking everything, local authority never inherited, a person
// arriving only where the installation bound their login, a stranger's seal refused, and the
// crossing remembered in the node's own ledger.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startCluster, type Cluster } from './harness';
import { ownerClient, readSnapshot, buildBundle, custodianOf, sealBundle, sealVerifier, verifyBundle, verifyBundleSeal, cross } from '../../seed/api/bundle.mjs';

let cluster: Cluster;
beforeAll(() => { cluster = startCluster(55443); });
afterAll(() => cluster.stop());

type Json = Record<string, any>;
const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const pem = () => generateKeyPairSync('ed25519').privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
const charter = { ...JSON.parse(readFileSync(resolve('seed/node.example.json'), 'utf8')), nodeLid: LID(900) };
const hashes = { genesisMd: '0'.repeat(64), linMd: '1'.repeat(64) };
const commit = 'a'.repeat(40);

describe('the crossing', () => {
  it('exports a sealed, verifiable bundle and lands it on another node additively, once', async () => {
    const source = await cluster.fresh(1);
    const target = await cluster.fresh(1);
    const src = ownerClient(source.connection); await src.connect();
    const dst = ownerClient(target.connection); await dst.connect();
    try {
      await src.query(`
        INSERT INTO users VALUES ('alice','{"displayName":"Alice","lid":"${LID(1)}"}');
        INSERT INTO persons VALUES ('alice','{"uid":"alice","lid":"${LID(1)}","displayName":"Alice"}');
        INSERT INTO lifetrees VALUES ('t1','{"lid":"${LID(11)}","anchorUid":"alice","name":"Nur","treeType":"LIGHTTREE","visibility":"public","genesisHash":"g1","latestHash":"h1","blockHeight":1,"createdAt":"2026-01-01T00:00:00.000000Z"}');
        INSERT INTO pulses VALUES ('p1','{"lid":"${LID(21)}","authorId":"alice","lifetreeId":"t1","type":"tree_growth","visibility":"public","hash":"h1","previousHash":"g1","createdAt":"2026-02-01T00:00:00.000000Z"}');
        INSERT INTO links(from_id,rel,to_id,lid,doc,created_at) VALUES ('alice','keeper','t1','${LID(61)}','{"since":"birth"}','2026-01-01T00:00:00Z');
        INSERT INTO loves VALUES ('lifetrees','t1','alice','{"uid":"alice","at":"2026-03-01T00:00:00.000000Z"}');
        INSERT INTO person_keys VALUES ('alice','fp1','{"pubkey":"AAAA"}');
        INSERT INTO pulse_signatures VALUES ('p1','alice','{"sig":"s","pubkey":"AAAA"}');
        INSERT INTO config VALUES ('superadmin','{"uid":"alice"}'); INSERT INTO admins VALUES ('alice','{}');
        INSERT INTO initiates VALUES ('i1','{"handle":"alice"}');`);
      const custodian = custodianOf(pem());
      const anchor = { fingerprint: custodian.fingerprint, publicKeyB64: custodian.publicKeyB64 };
      const snapshot = await readSnapshot(src);
      const full = sealBundle(await buildBundle({ snapshot, charter, exportCommit: commit, charterHashes: hashes }), custodian);
      // Verifiable in the hand: structure, census and seal; the beings index rides as a witness.
      expect((await verifyBundle(full)).ok).toBe(true);
      expect(await verifyBundleSeal(full, anchor, sealVerifier)).toBeNull();
      expect(full.docs.map((d: Json) => d.path)).toEqual(expect.arrayContaining(['beings/' + LID(1), 'beings/' + LID(11), 'beings/' + LID(21), 'links/alice__keeper__t1', 'lifetrees/t1/loves/alice', 'persons/alice/keys/fp1', 'pulses/p1/signatures/alice', 'initiates/i1']));
      expect(full.docs.find((d: Json) => d.path === 'links/alice__keeper__t1').data).toMatchObject({ from: 'alice', rel: 'keeper', to: 't1', lid: LID(61), since: 'birth', createdAt: '2026-01-01T00:00:00.000Z' });
      // A touched record breaks the census; a stranger's seal is no seal.
      const tampered = structuredClone(full); tampered.docs.find((d: Json) => d.path === 'lifetrees/t1').data.name = 'Oak';
      expect((await verifyBundle(tampered)).issues.map((i: Json) => i.code)).toContain('census_digest');
      const stranger = custodianOf(pem());
      expect(await verifyBundleSeal(full, { fingerprint: stranger.fingerprint, publicKeyB64: stranger.publicKeyB64 }, sealVerifier)).toBe('seal_key_unanchored');

      // On the far side: no identity is bound yet, and local authority never merges.
      let crossing = await cross(dst, { incoming: full, anchor, identities: [], apply: true });
      expect(crossing.applied).toBe(false);
      expect(crossing.plan.issues.map((i: Json) => i.code)).toEqual(expect.arrayContaining(['identity_unbound', 'local_authority']));
      const identities = [{ sourceUid: 'alice', targetUid: 'alice', personLid: LID(1) }];
      crossing = await cross(dst, { incoming: full, anchor, identities, apply: true });
      expect(crossing.plan.issues.map((i: Json) => i.code)).toContain('identity_conflict'); // the person has not spoken here, and no login was bound
      await dst.query("INSERT INTO seed.identity_bindings(issuer,subject,uid,binding_kind) VALUES ('https://issuer.example','sub-alice','alice','explicit')");
      crossing = await cross(dst, { incoming: full, anchor, identities, apply: true });
      expect(crossing.plan.issues.map((i: Json) => i.code)).toEqual(['local_authority', 'local_authority']);
      expect((await dst.query('SELECT count(*) FROM lifetrees')).rows[0].count).toBe('0');
      // Without the authority records the proposal is clear: planning alone writes nothing.
      const light = sealBundle(await buildBundle({ snapshot, charter, exportCommit: commit, charterHashes: hashes, withoutAuthority: true }), custodian);
      crossing = await cross(dst, { incoming: light, anchor, identities, apply: false });
      expect(crossing.plan.ready).toBe(true); expect(crossing.applied).toBe(false);
      expect((await dst.query('SELECT count(*) FROM lifetrees')).rows[0].count).toBe('0');
      crossing = await cross(dst, { incoming: light, anchor, identities, apply: true });
      expect(crossing.applied).toBe(true); expect(crossing.inserted).toBe(8);
      expect(crossing.plan.rebuild).toEqual(['beings/' + LID(1), 'beings/' + LID(11), 'beings/' + LID(21), 'initiates/i1']); // the witness index names the person, the tree and the block
      const landed = async (q: string) => (await dst.query(q)).rows;
      expect(await landed("SELECT doc->>'name' AS name FROM lifetrees WHERE id='t1'")).toEqual([{ name: 'Nur' }]);
      expect(await landed("SELECT from_id, rel, to_id, lid, doc, created_at::text FROM links")).toEqual([{ from_id: 'alice', rel: 'keeper', to_id: 't1', lid: LID(61), doc: { since: 'birth' }, created_at: expect.stringContaining('2026-01-01') }]);
      expect(await landed('SELECT parent_kind, parent_id, uid FROM loves')).toEqual([{ parent_kind: 'lifetrees', parent_id: 't1', uid: 'alice' }]);
      expect(await landed('SELECT person_id, id FROM person_keys')).toEqual([{ person_id: 'alice', id: 'fp1' }]);
      expect(await landed('SELECT pulse_id, id FROM pulse_signatures')).toEqual([{ pulse_id: 'p1', id: 'alice' }]);
      expect(await landed('SELECT count(*) FROM initiates')).toEqual([{ count: '0' }]);   // a witness, rebuilt from git, never landed
      expect(await landed('SELECT count(*) FROM admins')).toEqual([{ count: '0' }]);
      const ledger = await landed('SELECT manifest_hash, doc FROM seed.crossings');
      expect(ledger).toEqual([{ manifest_hash: light.manifestHash, doc: expect.objectContaining({ sourceNodeLid: LID(900), sourceDomain: 'node.example', sealFingerprint: custodian.fingerprint, inserted: 8 }) }]);
      // The same bundle again: everything unchanged, nothing landed twice, the ledger remembers the first crossing.
      crossing = await cross(dst, { incoming: light, anchor, identities, apply: true });
      expect(crossing.plan.ready).toBe(true); expect(crossing.inserted).toBe(0); expect(crossing.plan.unchanged).toHaveLength(8); expect(crossing.already).toBeTruthy();
      expect(await landed('SELECT count(*) FROM seed.crossings')).toEqual([{ count: '1' }]);
      // A record that differs here blocks the whole proposal; neither side is changed.
      await dst.query(`UPDATE lifetrees SET doc=doc||'{"name":"Oak"}' WHERE id='t1'`);
      crossing = await cross(dst, { incoming: light, anchor, identities, apply: true });
      expect(crossing.applied).toBe(false);
      expect(crossing.plan.issues).toEqual([expect.objectContaining({ code: 'content_conflict', path: 'lifetrees/t1' })]);
      expect(await landed("SELECT doc->>'name' AS name FROM lifetrees WHERE id='t1'")).toEqual([{ name: 'Oak' }]);
    } finally { await src.end(); await dst.end(); await source.db.close(); await target.db.close(); }
  });

  it('refuses an id that cannot travel and a charter that is not sound', async () => {
    const source = await cluster.fresh(1);
    const src = ownerClient(source.connection); await src.connect();
    try {
      await src.query(`INSERT INTO rays VALUES ('t1/2026-01-01','{"units":1}')`);
      await expect(readSnapshot(src)).rejects.toMatchObject({ code: 'id_not_portable', signature: 'rays' });
      await expect(buildBundle({ snapshot: [], charter: { ...charter, nodeLid: 'nope' }, exportCommit: commit, charterHashes: hashes })).rejects.toMatchObject({ code: 'charter_unsound' });
      await expect(buildBundle({ snapshot: [], charter, exportCommit: 'main', charterHashes: hashes })).rejects.toMatchObject({ code: 'commit_unsound' });
    } finally { await src.end(); await source.db.close(); }
  });
});
