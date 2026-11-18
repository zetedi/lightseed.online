// THE LAST HANDS against real PostgreSQL (ring 2026-11-03): the origin's one-time backfills as the
// keeper's own audits and repairs — the same names and report shapes, sealed blocks never touched,
// the keeper alone allowed, each run idempotent.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startCluster, type Cluster } from './harness';
import { createApi } from '../../seed/api/server.mjs';
import { createAuthenticator } from '../../seed/api/auth.mjs';
import { authFixture } from './auth-fixture.mjs';
import { createBlock } from '../../src/domain/chain/hash';

let cluster: Cluster;
beforeAll(() => { cluster = startCluster(55450); });
afterAll(() => cluster.stop());

type Json = Record<string, any>;
const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const serve = async () => {
  const { db } = await cluster.fresh(3);
  const fixture = authFixture(); // binds issuer-alice → alice and issuer-bob → bob
  const server = createApi(db, await createAuthenticator(fixture.config), { nodeDomain: 'node.example' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing_address');
  const base = `http://127.0.0.1:${address.port}`;
  const tokens: Record<string, string> = { alice: fixture.token(), bob: fixture.token({ sub: 'issuer-bob' }) };
  const repair = async (who: string, command: Json) => {
    const response = await fetch(`${base}/v1/repairs/command`, { method: 'POST', headers: { authorization: `Bearer ${tokens[who]}`, 'content-type': 'application/json' }, body: JSON.stringify(command) });
    return { status: response.status, body: await response.json() as Json };
  };
  cluster.sql(`
    INSERT INTO config VALUES ('superadmin','{"uid":"alice"}');
    INSERT INTO users VALUES ('alice','{"lid":"${LID(1)}"}'), ('bob','{"lid":"${LID(2)}"}');
    INSERT INTO persons VALUES ('alice','{"uid":"alice","lid":"${LID(1)}"}'), ('bob','{"uid":"bob"}');
    INSERT INTO lifetrees VALUES ('t1','{"lid":"${LID(11)}","anchorUid":"alice","name":"Nur","treeType":"LIFETREE","genesisHash":"g1","latestHash":"g1","blockHeight":0,"createdAt":"2026-01-01T00:00:00.000000Z"}'),
      ('t2','{"lid":"${LID(12)}","anchorUid":"bob","name":"Ash","treeType":"LIFETREE","visibility":"private","genesisHash":"g2","latestHash":"g2","blockHeight":0}'),
      ('t3','{"anchorUid":"alice","name":"Nameless","treeType":"GUARDED","visibility":"","createdAt":"2025-06-01T00:00:00.000000Z"}');
    INSERT INTO visions VALUES ('v1','{"lid":"${LID(21)}","authorId":"alice","lifetreeId":"t1","createdAt":"2026-02-01T00:00:00.000000Z"}'),
      ('v2','{"lid":"${LID(12)}","authorId":"bob","lifetreeId":"t2","genesisHash":"gv2","latestHash":"gv2","blockHeight":0}'),
      ('v3','{"lid":"${LID(23)}","authorId":"bob","title":"Root Vision","lifetreeId":"t-gone","genesisHash":"gv3","latestHash":"gv3","blockHeight":0,"createdAt":"2026-05-01T00:00:00.000000Z"}');
    INSERT INTO pulses VALUES ('p1','{"lid":"${LID(31)}","authorId":"alice","lifetreeId":"t1","type":"GROWTH","hash":"h1","previousHash":"g1","createdAt":"2026-01-02T00:00:00.000000Z"}'),
      ('p2','{"lid":"${LID(32)}","authorId":"alice","lifetreeId":"t1","type":"growth","hash":"h2","previousHash":"h1","hashVersion":1,"createdAt":"2026-01-03T00:00:00.000000Z"}'),
      ('p3','{"authorId":"alice","lifetreeId":"t1","type":"standard","visibility":"public","isMatch":true,"hash":"h3","previousHash":"h2","createdAt":"2026-03-01T00:00:00.000000Z"}'),
      ('p4','{"lid":"${LID(34)}","authorId":"alice","lifetreeId":"t1","type":"standard","visibility":"public","isMatch":true,"hash":"h4","previousHash":"h3","hashVersion":1,"createdAt":"2026-03-02T00:00:00.000000Z"}'),
      ('p5','{"lid":"${LID(35)}","authorId":"alice","type":"standard","visibility":"public","isMatch":true,"hash":"h5","previousHash":"STANDARD","createdAt":"2026-03-03T00:00:00.000000Z"}');
    INSERT INTO alignments VALUES ('a1','{"lid":"${LID(41)}","initiatorTreeId":"t1","targetTreeId":"t2","initiatorUid":"alice","targetUid":"bob","status":"ACCEPTED","createdAt":"2026-02-15T00:00:00.000000Z"}'),
      ('a2','{"lid":"${LID(42)}","initiatorTreeId":"t1","targetTreeId":"t2","initiatorUid":"alice","targetUid":"bob","status":"ACCEPTED","createdAt":"2026-03-15T00:00:00.000000Z"}'),
      ('a3','{"lid":"${LID(43)}","initiatorTreeId":"t2","targetTreeId":"t1","initiatorUid":"bob","targetUid":"alice","status":"PENDING","createdAt":"2026-01-15T00:00:00.000000Z"}');
    INSERT INTO communities VALUES ('c1','{"anchorUid":"alice","name":"Circle","domain":"circle.example"}');
    INSERT INTO light_houses VALUES ('h1','{"anchorUid":"alice","name":"Hearth","createdAt":"2026-04-01T00:00:00.000000Z"}');
  `);
  return { db, server, repair, sql: cluster.sql };
};

describe('the last hands', () => {
  it('audits and repairs the soil as the keeper, by the origin\'s names and shapes, never touching a sealed block', async () => {
    const t = await serve();
    try {
      // The keeper alone.
      expect((await t.repair('bob', { kind: 'pulse_visibility' })).status).toBe(403);
      expect((await t.repair('alice', { kind: 'drop_everything' })).status).toBe(400);

      // THE OLD TIE BECOMES A GROUND (rings 2026-11-17 and -18). The plan: v1's author anchors t1, so
      // it would be grounded there; v3 names a tree that is gone; v2 names a private tree, which
      // grounds no one. Only the keeper may ask, and without `apply` nothing is written.
      expect((await t.repair('bob', { kind: 'vision_grounds' })).status).toBe(403);
      expect((await t.repair('bob', { kind: 'vision_grounds', apply: true })).status).toBe(403);
      const rows = [
        { visionId: 'v1', treeId: 't1', verdict: 'ground', self: true, birth: false },   // eldest first; v2 carries no birth moment
        { visionId: 'v3', treeId: 't-gone', verdict: 'tree_gone', self: false, birth: false },
        { visionId: 'v2', treeId: 't2', verdict: 'refused', refusal: 'ground_tree_hidden', self: false, birth: false },
      ];
      const plan = await t.repair('alice', { kind: 'vision_grounds' });
      expect(plan.status).toBe(200);
      expect(plan.body.apply).toBe(false);
      expect(plan.body.counts).toMatchObject({ visions: 3, withoutField: 0, ground: 1, refused: 1, tree_gone: 1, births: 0 });
      expect(plan.body.refusals).toEqual({ ground_tree_hidden: 1 });
      expect(plan.body.rows).toEqual(rows);
      expect(t.sql("SELECT count(*) FROM links WHERE rel in ('grounded_in','ground_request')")).toBe('0');
      expect(t.sql("SELECT doc->>'lifetreeId' FROM visions WHERE id='v3'")).toBe('t-gone');

      // The apply, by the keeper's three words: LINKS ALONE (no block on either chain, both heads
      // unmoved), the grounded vision KEEPS its field, the orphan's field is CLEARED, and what the
      // law refuses is left exactly as it was.
      const pulsesBefore = t.sql('SELECT count(*) FROM pulses');
      const crossed = await t.repair('alice', { kind: 'vision_grounds', apply: true });
      expect(crossed.status).toBe(200);
      expect(crossed.body).toMatchObject({ apply: true, grounded: 1, cleared: 1, skipped: 0, rows });
      expect(JSON.parse(t.sql("SELECT doc FROM links WHERE from_id='v1' AND rel='grounded_in' AND to_id='t1'"))).toEqual({ self: true, birth: false, requestedBy: 'alice', acceptedBy: 'alice', migrated: true });
      expect(t.sql("SELECT lid FROM links WHERE from_id='v1' AND rel='grounded_in'")).toMatch(V7);
      expect(t.sql("SELECT count(*) FROM links WHERE rel='grounded_in'")).toBe('1');
      expect(t.sql('SELECT count(*) FROM pulses')).toBe(pulsesBefore);
      expect(t.sql("SELECT (doc->>'latestHash')||' '||(doc->>'blockHeight') FROM lifetrees WHERE id='t1'")).toBe('g1 0');
      expect(t.sql("SELECT doc->>'lifetreeId' FROM visions WHERE id='v1'")).toBe('t1');
      expect(t.sql("SELECT (doc ? 'lifetreeId')::text||' '||(doc->>'title')||' '||(doc->>'authorId') FROM visions WHERE id='v3'")).toBe('false Root Vision bob');
      expect(t.sql("SELECT doc->>'lifetreeId' FROM visions WHERE id='v2'")).toBe('t2');
      // Said twice, it writes nothing more: the ground stands, the orphan carries no field.
      const again = await t.repair('alice', { kind: 'vision_grounds', apply: true });
      expect(again.body).toMatchObject({ apply: true, grounded: 0, cleared: 0, skipped: 0 });
      expect(again.body.counts).toMatchObject({ already: 1, withoutField: 1, refused: 1, ground: 0, tree_gone: 0 });
      // The soil re-proves each act whatever the plan believed: the keeper's own hand cannot ground
      // what the law forbids, nor a vision whose field names another tree, nor clear a living tree's field.
      expect(t.sql("SET seed.uid='alice'; SELECT seed.repair_vision_ground('v2','t2',false,'" + LID(90) + "')").trim().endsWith('f')).toBe(true);
      expect(t.sql("SET seed.uid='alice'; SELECT seed.repair_vision_ground('v2','t1',false,'" + LID(91) + "')").trim().endsWith('f')).toBe(true);
      expect(t.sql("SET seed.uid='alice'; SELECT seed.repair_vision_ground_clear('v2','t2')").trim().endsWith('f')).toBe(true);

      // Visibility: p1 lacks it and is unsealed; p2 lacks it and is sealed — counted, kept.
      expect(await t.repair('alice', { kind: 'pulse_visibility' })).toEqual({ status: 200, body: { updated: 1, skippedSealed: 1 } });
      expect(t.sql("SELECT doc->>'visibility' FROM pulses WHERE id='p1'")).toBe('public');
      expect(t.sql("SELECT coalesce(doc->>'visibility','-') FROM pulses WHERE id='p2'")).toBe('-');
      expect(await t.repair('alice', { kind: 'pulse_visibility' })).toEqual({ status: 200, body: { updated: 0, skippedSealed: 1 } });

      // Type casing: p1 GROWTH → tree_growth; p2 growth is sealed — kept.
      expect(await t.repair('alice', { kind: 'pulse_type_casing' })).toEqual({ status: 200, body: { updated: 1, skippedSealed: 1 } });
      expect(t.sql("SELECT doc->>'type' FROM pulses WHERE id='p1'")).toBe('tree_growth');
      expect(t.sql("SELECT doc->>'type' FROM pulses WHERE id='p2'")).toBe('growth');

      // Tree visibility: t1 (absent) and t3 (empty) become public; t2 keeps private.
      expect(await t.repair('alice', { kind: 'tree_visibility' })).toEqual({ status: 200, body: { updated: 2 } });
      expect(t.sql("SELECT string_agg(id||':'||(doc->>'visibility'), ',' ORDER BY id) FROM lifetrees")).toBe('t1:public,t2:private,t3:public');

      // The twin awakens: v1 gains a genesis sealed from its own birth; v2 was chained.
      expect(await t.repair('alice', { kind: 'vision_chains' })).toEqual({ status: 200, body: { updated: 1, skipped: 2 } });
      const genesis = await createBlock('0', { msg: 'Birth' }, Date.parse('2026-02-01T00:00:00.000000Z'));
      expect(t.sql("SELECT (doc->>'genesisHash')||' '||(doc->>'latestHash')||' '||(doc->>'blockHeight') FROM visions WHERE id='v1'")).toBe(`${genesis} ${genesis} 0`);
      expect(await t.repair('alice', { kind: 'vision_chains' })).toEqual({ status: 200, body: { updated: 0, skipped: 3 } });

      // Lids: t3, c1, h1, persons/bob and p3 (unsealed) are named from their birth; a sealed block without a lid would be counted.
      const lids = await t.repair('alice', { kind: 'lids' });
      expect(lids).toEqual({ status: 200, body: { lifetrees: 1, communities: 1, lightHouses: 1, persons: 1, pulses: 1, total: 5, skippedSealed: 0 } });
      for (const q of ["SELECT doc->>'lid' FROM lifetrees WHERE id='t3'", "SELECT doc->>'lid' FROM communities WHERE id='c1'", "SELECT doc->>'lid' FROM light_houses WHERE id='h1'", "SELECT doc->>'lid' FROM persons WHERE id='bob'", "SELECT doc->>'lid' FROM pulses WHERE id='p3'"]) expect(t.sql(q)).toMatch(V7);
      // The time inside the name is the record's own birth: t3 was born in June 2025.
      expect(parseInt(t.sql("SELECT replace(substr(doc->>'lid',1,13),'-','') FROM lifetrees WHERE id='t3'"), 16)).toBe(Date.parse('2025-06-01T00:00:00.000Z'));
      expect(await t.repair('alice', { kind: 'lids' })).toEqual({ status: 200, body: { total: 0, skippedSealed: 0 } });

      // Match ids: p3 names a1 (the newest accepted before March 1st); p4 is sealed; p5 has no tree.
      expect(await t.repair('alice', { kind: 'match_ids' })).toEqual({ status: 200, body: { stamped: 1, unresolved: 1, skippedSealed: 1 } });
      expect(t.sql("SELECT doc->>'matchId' FROM pulses WHERE id='p3'")).toBe('a1');
      expect(t.sql("SELECT coalesce(doc->>'matchId','-') FROM pulses WHERE id='p4'")).toBe('-');

      // The index audit: nothing to write here; v2 wears t2's lid — one true name on two beings.
      const audit = await t.repair('alice', { kind: 'lid_index', apply: true });
      expect(audit.status).toBe(200);
      expect(audit.body).toEqual({ apply: true, wrote: 0, nameless: 0, disagreements: [], collisions: [{ address: 'lifetrees/t2 | visions/v2', lids: [LID(12)] }] });
    } finally { t.server.close(); await t.db.close(); }
  });
});
