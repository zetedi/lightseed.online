// THE GROUND against real PostgreSQL (ring 2026-11-17): the origin's askGround / acceptGround /
// releaseGround on the independent node, asked through the API as the restricted runtime role with
// real bearers. The same law (src/domain/grounding.ts) judges on both soils; this proves the soil
// holds it: both consents, both chains, nothing private, the caps, and that no other door makes a
// knock or a ground.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startCluster, type Cluster } from './harness';
import { createApi } from '../../seed/api/server.mjs';
import { createAuthenticator } from '../../seed/api/auth.mjs';
import { authFixture } from './auth-fixture.mjs';
import { verifyBlockSeal } from '../../src/domain/chain/verify';

let cluster: Cluster;
beforeAll(() => { cluster = startCluster(55461); });
afterAll(() => cluster.stop());

type Json = Record<string, any>;
const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const serve = async () => {
  const { db } = await cluster.fresh(3);
  const fixture = authFixture();
  fixture.config.bindings.push({ subject: 'issuer-carol', uid: 'carol' }, { subject: 'issuer-staff', uid: 'staff' });
  const server = createApi(db, await createAuthenticator(fixture.config), { nodeDomain: 'node.example' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing_address');
  const base = `http://127.0.0.1:${address.port}`;
  const tokens: Record<string, string> = { alice: fixture.token(), bob: fixture.token({ sub: 'issuer-bob' }), carol: fixture.token({ sub: 'issuer-carol' }), staff: fixture.token({ sub: 'issuer-staff' }) };
  const post = async (path: string, command: Json, who?: string) => {
    const r = await fetch(base + path, { method: 'POST', body: JSON.stringify(command), headers: { ...(who ? { authorization: 'Bearer ' + tokens[who] } : {}), 'content-type': 'application/json' } });
    return { status: r.status, body: await r.json() as Json };
  };
  const get = async (path: string, who?: string) => {
    const r = await fetch(base + path, { headers: who ? { authorization: 'Bearer ' + tokens[who] } : {} });
    return { status: r.status, body: await r.json() as Json };
  };
  const ground = (action: string, who: string | undefined, visionId = 'v1', treeId = 't1') => post('/v1/grounding/command', { action, visionId, treeId }, who);
  const close = async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); };
  const doc = (table: string, id: string): Json | null => { const row = cluster.sql(`SELECT doc::text FROM ${table} WHERE id='${id}'`); return row ? JSON.parse(row) : null; };
  const link = (rel: string, visionId = 'v1', treeId = 't1'): Json | null => { const row = cluster.sql(`SELECT doc::text FROM links WHERE from_id='${visionId}' AND rel='${rel}' AND to_id='${treeId}'`); return row ? JSON.parse(row) : null; };
  const pulsesOf = (field: string, id: string): Json[] => JSON.parse(cluster.sql(`SELECT coalesce(jsonb_agg(doc ORDER BY (doc->>'mintedAt')::numeric, doc->>'groundAct'),'[]')::text FROM pulses WHERE doc->>'${field}'='${id}'`));
  return { post, get, ground, close, sql: cluster.sql, doc, link, pulsesOf };
};

// ALICE voices vision v1 (public). BOB anchors tree t1 (public); CAROL is a steward of it. STAFF is staff.
const world = (sql: (q: string) => string, over: { treeVisibility?: string; visionVisibility?: string; treeType?: string } = {}) => sql(`
  INSERT INTO users VALUES ('alice','{"displayName":"Alice"}'),('bob','{"displayName":"Bob"}'),('carol','{"displayName":"Carol"}'),('staff','{"displayName":"Staff"}');
  INSERT INTO persons VALUES ('alice','{"uid":"alice","lid":"${LID(1)}","displayName":"Alice"}'),('bob','{"uid":"bob","lid":"${LID(2)}","displayName":"Bob"}'),
    ('carol','{"uid":"carol","lid":"${LID(3)}","displayName":"Carol"}'),('staff','{"uid":"staff","lid":"${LID(4)}","displayName":"Staff"}');
  INSERT INTO admins VALUES ('staff','{}');
  INSERT INTO lifetrees VALUES ('t1','{"lid":"${LID(11)}","anchorUid":"bob","name":"Oak","treeType":"${over.treeType ?? 'LIFETREE'}","visibility":"${over.treeVisibility ?? 'public'}","domain":"node.example","createdAt":"2026-01-01T00:00:00.000000Z","genesisHash":"tgen","latestHash":"tgen","blockHeight":0}'),
    ('t2','{"lid":"${LID(12)}","anchorUid":"alice","name":"Birch","treeType":"LIFETREE","visibility":"public","domain":"node.example","createdAt":"2026-01-01T00:00:00.000000Z","genesisHash":"t2gen","latestHash":"t2gen","blockHeight":0}');
  INSERT INTO visions VALUES ('v1','{"lid":"${LID(21)}","authorId":"alice","title":"Clear water","body":"…","visibility":"${over.visionVisibility ?? 'public'}","domain":"node.example","createdAt":"2026-01-01T00:00:00.000000Z","genesisHash":"vgen","latestHash":"vgen","blockHeight":0}');
  INSERT INTO links(from_id,rel,to_id,lid) VALUES ('carol','steward','t1','${LID(61)}');
`);

describe('the ground on the independent node', () => {
  it('the author knocks, a carer answers, and both chains bear it', async () => {
    const t = await serve();
    try {
      world(t.sql);
      // Only the author knocks — and a missing vision or tree answers exactly as "not yours".
      expect((await t.ground('ask', undefined)).status).toBe(401);
      expect((await t.ground('ask', 'bob')).body).toEqual({ error: 'ground_ask_author_only' });
      expect((await t.ground('ask', 'alice', 'nowhere')).body).toEqual({ error: 'ground_ask_author_only' });
      expect((await t.ground('ask', 'alice', 'v1', 'nowhere')).body).toEqual({ error: 'ground_ask_author_only' });
      // No yes without a knock.
      expect((await t.ground('accept', 'bob')).body).toEqual({ error: 'ground_no_request' });
      expect((await t.ground('ask', 'alice')).body).toEqual({ asked: true });
      expect(t.link('ground_request')).toEqual({ requestedBy: 'alice' });
      expect((await t.ground('ask', 'alice')).body).toEqual({ error: 'ground_already_asked' });
      // Only a carer answers: not the author (no carer of this tree), not staff as staff.
      expect((await t.ground('accept', 'alice')).body).toEqual({ error: 'ground_accept_carer_only' });
      expect((await t.ground('accept', 'staff')).body).toEqual({ error: 'ground_accept_carer_only' });
      // A steward is a carer.
      const yes = await t.ground('accept', 'carol');
      expect(yes.status).toBe(200);
      expect(yes.body.self).toBe(false);
      expect(t.link('ground_request')).toBeNull();
      expect(t.link('grounded_in')).toMatchObject({ self: false, birth: false, requestedBy: 'alice', acceptedBy: 'carol' });
      const [onTree] = t.pulsesOf('lifetreeId', 't1'), [onVision] = t.pulsesOf('visionId', 'v1');
      expect(onTree).toMatchObject({ type: 'standard', groundAct: 'grounded', groundRole: 'tree', groundTwinOf: 'v1', groundTwinKind: 'vision', authorId: 'carol', authorName: 'Carol', previousHash: 'tgen', visibility: 'public' });
      expect(onVision).toMatchObject({ type: 'vision_growth', groundAct: 'grounded', groundRole: 'vision', groundTwinOf: 't1', groundTwinKind: 'tree', authorId: 'carol', previousHash: 'vgen', visionTitle: 'Clear water' });
      expect(await verifyBlockSeal(onTree as never)).toBe(true);
      expect(await verifyBlockSeal(onVision as never)).toBe(true);
      expect(t.doc('lifetrees', 't1')).toMatchObject({ latestHash: onTree.hash, blockHeight: 1 });
      expect(t.doc('visions', 'v1')).toMatchObject({ latestHash: onVision.hash, blockHeight: 1 });
      // The knock was let go with the yes: a second yes finds none to answer, and a second knock finds the ground.
      expect((await t.ground('accept', 'bob')).body).toEqual({ error: 'ground_no_request' });
      expect((await t.ground('ask', 'alice')).body).toEqual({ error: 'ground_already' });
      // The LIN shows the ground to the world, with how it was made.
      const read = await t.get('/v1/links?to=t1&rel=grounded_in');
      expect(read.body.links).toHaveLength(1);
      expect(read.body.links[0]).toMatchObject({ from: 'v1', to: 't1', rel: 'grounded_in', self: false, birth: false });
    } finally { await t.close(); }
  });

  it('either side lets go alone, and the letting go is a second pair of blocks', async () => {
    const t = await serve();
    try {
      world(t.sql);
      await t.ground('ask', 'alice'); await t.ground('accept', 'bob');
      expect((await t.ground('release', 'staff')).body).toEqual({ error: 'ground_release_not_yours' });
      const gone = await t.ground('release', 'alice');
      expect(gone.status).toBe(200);
      expect(t.link('grounded_in')).toBeNull();
      const onTree = t.pulsesOf('lifetreeId', 't1'), onVision = t.pulsesOf('visionId', 'v1');
      expect(onTree.map(p => p.groundAct)).toEqual(['grounded', 'released']);
      expect(onVision.map(p => p.groundAct)).toEqual(['grounded', 'released']);
      expect(onTree[1]).toMatchObject({ authorId: 'alice', previousHash: onTree[0].hash });
      expect(t.doc('lifetrees', 't1')).toMatchObject({ latestHash: onTree[1].hash, blockHeight: 2 });
      expect(t.doc('visions', 'v1')).toMatchObject({ latestHash: onVision[1].hash, blockHeight: 2 });
      expect((await t.ground('release', 'alice')).body).toEqual({ error: 'ground_not_standing' });
      // Asked again and answered again, a carer of the tree lets it go this time.
      await t.ground('ask', 'alice'); await t.ground('accept', 'bob');
      expect((await t.ground('release', 'carol')).status).toBe(200);
      expect(t.pulsesOf('lifetreeId', 't1')).toHaveLength(4);
    } finally { await t.close(); }
  });

  it('a vision grown from one\'s own tree needs no knock, and says it is its author\'s own', async () => {
    const t = await serve();
    try {
      world(t.sql);
      const own = await t.ground('accept', 'alice', 'v1', 't2');
      expect(own.body.self).toBe(true);
      expect(t.link('grounded_in', 'v1', 't2')).toMatchObject({ self: true, requestedBy: 'alice', acceptedBy: 'alice' });
      expect(t.pulsesOf('lifetreeId', 't2')[0]).toMatchObject({ groundSelf: true, authorId: 'alice' });
    } finally { await t.close(); }
  });

  it('a knock is withdrawn by its author or declined by a carer, and by no one else', async () => {
    const t = await serve();
    try {
      world(t.sql);
      expect((await t.ground('drop', 'alice')).body).toEqual({ error: 'ground_no_request' });
      await t.ground('ask', 'alice');
      expect((await t.ground('drop', 'staff')).body).toEqual({ error: 'ground_release_not_yours' });
      expect((await t.ground('drop', 'alice')).body).toEqual({ dropped: true });
      await t.ground('ask', 'alice');
      expect((await t.ground('drop', 'carol')).body).toEqual({ dropped: true });
      expect(t.link('ground_request')).toBeNull();
    } finally { await t.close(); }
  });

  it('nothing private, secret, or furniture takes ground; a tree grounds nothing seen further than itself', async () => {
    for (const [over, refusal] of [
      [{ treeVisibility: 'private' }, 'ground_tree_hidden'],
      [{ visionVisibility: 'private' }, 'ground_vision_hidden'],
      [{ treeVisibility: 'node' }, 'ground_tree_hidden'],
      [{ treeType: 'SECRET' }, 'ground_secret_tree'],
      [{ treeType: 'BED' }, 'ground_bed'],
    ] as const) {
      const t = await serve();
      try {
        world(t.sql, over);
        expect((await t.ground('ask', 'alice')).body).toEqual({ error: refusal });
        expect(t.link('ground_request')).toBeNull();
      } finally { await t.close(); }
    }
  });

  it('the yes stands only on a knock made by the one who is the author now', async () => {
    const t = await serve();
    try {
      world(t.sql);
      await t.ground('ask', 'alice');
      // The vision changes hands behind the API's back (a staff mend): the new author never asked.
      t.sql(`UPDATE visions SET doc=doc || '{"authorId":"carol"}' WHERE id='v1'`);
      expect((await t.ground('accept', 'bob')).body).toEqual({ error: 'ground_no_request' });
      expect(t.link('grounded_in')).toBeNull();
    } finally { await t.close(); }
  });

  it('a vision stands in at most twelve trees and a tree grounds at most twelve visions', async () => {
    const t = await serve();
    try {
      world(t.sql);
      t.sql(`INSERT INTO links(from_id,rel,to_id,lid) SELECT 'v1','grounded_in','x'||n,'${LID(700).slice(0, -2)}'||lpad(n::text,2,'0') FROM generate_series(1,11) n`);
      expect((await t.ground('ask', 'alice')).body).toEqual({ asked: true });   // the twelfth place, waiting
      expect((await t.ground('ask', 'alice', 'v1', 't2')).body).toEqual({ error: 'ground_vision_full' });
      t.sql(`DELETE FROM links WHERE rel in ('grounded_in','ground_request')`);
      t.sql(`INSERT INTO links(from_id,rel,to_id,lid) SELECT 'y'||n,'grounded_in','t1','${LID(800).slice(0, -2)}'||lpad(n::text,2,'0') FROM generate_series(1,12) n`);
      await t.ground('ask', 'alice');
      expect((await t.ground('accept', 'bob')).body).toEqual({ error: 'ground_tree_full' });
    } finally { await t.close(); }
  });

  it('no other door makes a knock or a ground, and a vision is not handed to another', async () => {
    const t = await serve();
    try {
      world(t.sql);
      for (const rel of ['ground_request', 'grounded_in']) {
        expect((await t.post('/v1/links/command', { action: 'link', from: 'v1', rel, to: 't1' }, 'alice')).status).toBe(400);
        expect((await t.post('/v1/links/command', { action: 'link', from: 'v1', rel, to: 't1' }, 'staff')).status).toBe(400);
      }
      await t.ground('ask', 'alice'); await t.ground('accept', 'bob');
      expect((await t.post('/v1/links/command', { action: 'unlink', from: 'v1', rel: 'grounded_in', to: 't1' }, 'alice')).status).toBe(400);
      expect(t.link('grounded_in')).not.toBeNull();
      // The author may edit their vision's words, never its author; staff keep the mend.
      const edit = (who: string, patch: Json) => t.post('/v1/docs/command', { action: 'update', collection: 'visions', id: 'v1', patch }, who);
      expect((await edit('alice', { title: 'Clearer water' })).status).toBe(200);
      expect((await edit('alice', { authorId: 'bob' })).status).toBe(403);
      expect(t.doc('visions', 'v1')).toMatchObject({ authorId: 'alice', title: 'Clearer water' });
      // The retired tree field is written by no hand (ring 2026-11-18), staff included.
      expect((await edit('alice', { lifetreeId: 't1' })).status).toBe(403);
      expect((await edit('staff', { lifetreeId: 't1' })).status).toBe(403);
      expect(t.doc('visions', 'v1')).not.toHaveProperty('lifetreeId');
      expect((await edit('staff', { authorId: 'bob' })).status).toBe(200);
    } finally { await t.close(); }
  });

  it('planting a lifetree births no vision', async () => {
    const t = await serve();
    try {
      world(t.sql);
      const planted = await t.post('/v1/trees/command', { action: 'plant', name: 'Willow', body: 'by the river', treeType: 'LIFETREE', visibility: 'public' }, 'alice');
      expect(planted.status).toBe(200);
      expect(t.sql(`SELECT count(*) FROM visions`)).toBe('1'); // only v1, as before
    } finally { await t.close(); }
  });
});
