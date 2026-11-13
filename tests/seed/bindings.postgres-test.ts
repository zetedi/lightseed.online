// THE BINDING CEREMONY against real PostgreSQL (ring 2026-11-03): the reviewed bindings become durable
// rows at boot, a standing row under another uid is never relinked, a self-enrolled login the file names
// is affirmed, and a crossing then lands the person before they have spoken here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startCluster, type Cluster } from './harness';
import { ownerClient, buildBundle, custodianOf, sealBundle, cross } from '../../seed/api/bundle.mjs';

let cluster: Cluster;
beforeAll(() => { cluster = startCluster(55451); });
afterAll(() => cluster.stop());

type Json = Record<string, any>;
const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const pem = () => generateKeyPairSync('ed25519').privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
const ISSUER = 'https://issuer.example';

describe('the binding ceremony', () => {
  it('binds the reviewed subjects once, reports a conflict without relinking, affirms an enrolled login, and lets the crossing land the person', async () => {
    const target = await cluster.fresh(1);
    const bind = (bindings: Json[], issuer = ISSUER) => target.db.withSession(null, (c: any) => c.query('SELECT seed.bind_explicit($1,$2::jsonb) AS result', [issuer, JSON.stringify(bindings)])).then((r: any) => r.rows[0].result);
    const rows = () => cluster.sql("SELECT string_agg(subject||'='||uid||':'||binding_kind, ',' ORDER BY subject) FROM seed.identity_bindings");
    expect(await bind([{ subject: 's-alice', uid: 'alice' }, { subject: 's-bob', uid: 'bob' }])).toEqual({ bound: 2, standing: 0, conflicts: [] });
    expect(await bind([{ subject: 's-alice', uid: 'alice' }, { subject: 's-bob', uid: 'bob' }])).toEqual({ bound: 0, standing: 2, conflicts: [] });
    // The durable record wins over a changed file; nothing is relinked.
    expect(await bind([{ subject: 's-alice', uid: 'mallory' }])).toEqual({ bound: 0, standing: 0, conflicts: [{ subject: 's-alice', uid: 'mallory', bound: 'alice' }] });
    // A login that enrolled itself and is now named by the installation becomes explicit.
    cluster.sql(`INSERT INTO seed.identity_bindings(issuer,subject,uid,binding_kind) VALUES ('${ISSUER}','s-carol','oidc_carol','enrolled')`);
    expect(await bind([{ subject: 's-carol', uid: 'oidc_carol' }])).toEqual({ bound: 0, standing: 1, conflicts: [] });
    expect(rows()).toBe('s-alice=alice:explicit,s-bob=bob:explicit,s-carol=oidc_carol:explicit');
    // The resolver's validation stands here too.
    for (const bad of [[[{ subject: 's', uid: 'u' }], 'http://issuer.example'], [[{ subject: '', uid: 'u' }], ISSUER], [[{ subject: 's', uid: 'a b' }], ISSUER], [{ not: 'an array' } as unknown as Json[], ISSUER]] as const) {
      await expect(bind(bad[0] as Json[], bad[1])).rejects.toMatchObject({ code: '22023' });
    }

    // The crossing: alice has not spoken here, but her login is bound — she arrives with the import.
    const charter = JSON.parse(readFileSync(resolve('src/config/charter.json'), 'utf8'));
    const custodian = custodianOf(pem());
    const anchor = { fingerprint: custodian.fingerprint, publicKeyB64: custodian.publicKeyB64 };
    const snapshot = [
      { path: 'users/alice', data: { lid: LID(1), displayName: 'Alice' } },
      { path: 'persons/alice', data: { uid: 'alice', lid: LID(1) } },
      { path: 'lifetrees/t1', data: { lid: LID(11), anchorUid: 'alice', name: 'Nur', treeType: 'LIFETREE', visibility: 'public', genesisHash: 'g1', latestHash: 'g1', blockHeight: 0 } },
    ];
    const bundle = sealBundle(await buildBundle({ snapshot, charter, exportCommit: 'c'.repeat(40), charterHashes: { genesisMd: '0'.repeat(64), linMd: '1'.repeat(64) } }), custodian);
    const dst = ownerClient(target.connection); await dst.connect();
    try {
      const crossing = await cross(dst, { incoming: bundle, anchor, identities: [{ sourceUid: 'alice', targetUid: 'alice', personLid: LID(1) }], apply: true });
      expect(crossing.plan.issues).toEqual([]);
      expect(crossing.applied).toBe(true); expect(crossing.inserted).toBe(3);
    } finally { await dst.end(); await target.db.close(); }
  });
});
