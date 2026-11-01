// THE DOCUMENT DOOR against real PostgreSQL (ring 2026-11-02): the law of firestore.rules, asked
// through the API as the restricted runtime role — reads under the row policies, writes through
// seed.doc_write, love through seed.love_toggle — with the refusals the rules tests prove on the
// Firebase side: forged anchors, frozen fields, another's slot, a chain block's deletion, the
// outsider's touch on a circle's decision, a double-booked bed.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startCluster, type Cluster } from './harness';
import { createApi } from '../../seed/api/server.mjs';
import { createAuthenticator } from '../../seed/api/auth.mjs';
import { authFixture } from './auth-fixture.mjs';

let cluster: Cluster;
beforeAll(() => { cluster = startCluster(55441); });
afterAll(() => cluster.stop());

type Json = Record<string, any>;
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
  const headers = (who?: string): Record<string, string> => (who ? { authorization: 'Bearer ' + tokens[who] } : {});
  const get = async (path: string, who?: string) => { const r = await fetch(base + path, { headers: headers(who) }); return { status: r.status, body: await r.json() as Json }; };
  const post = async (command: Json, who?: string) => {
    const r = await fetch(base + '/v1/docs/command', { method: 'POST', body: JSON.stringify(command), headers: { ...headers(who), 'content-type': 'application/json' } });
    return { status: r.status, body: await r.json() as Json };
  };
  const close = async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); };
  return { db, get, post, close, sql: cluster.sql };
};

describe('the document door', () => {
  it('reads one document under the get law and pages under the row policies, as the asking hand alone', async () => {
    const t = await serve();
    try {
      t.sql(`INSERT INTO users VALUES ('alice','{"displayName":"Alice","invitesRemaining":7}'),('bob','{"displayName":"Bob"}');
        INSERT INTO persons VALUES ('alice','{"uid":"alice","lid":"019a0000-0000-7000-8000-000000000001","displayName":"Alice","anonymous":true}');
        INSERT INTO stays VALUES ('s1','{"uid":"bob","hostUid":"alice","bedId":"bed1","status":"requested","fromDate":"2026-12-01","toDate":"2026-12-02","createdAt":"2026-11-01T10:00:00.000000Z"}'),
          ('s2','{"uid":"carol","hostUid":"alice","bedId":"bed1","status":"requested","fromDate":"2026-12-05","toDate":"2026-12-06","createdAt":"2026-11-01T11:00:00.000000Z"}');
        INSERT INTO network_invites VALUES ('token1','{"email":"x@y.z","invitedByUserId":"alice","status":"pending"}');
        INSERT INTO rays VALUES ('t1__2026-11-01__carer','{"holderUid":"alice","units":1,"treeId":"t1"}');`);
      expect((await t.get('/v1/docs/users?id=alice', 'alice')).body.doc).toMatchObject({ id: 'alice', displayName: 'Alice' });
      expect((await t.get('/v1/docs/users?id=alice', 'bob')).status).toBe(404);
      expect((await t.get('/v1/docs/users?id=alice')).status).toBe(404);
      expect((await t.get('/v1/docs/persons?id=alice')).body.doc.anonymous).toBe(true);
      // Lists: the host sees both stays newest-first with a cursor; a guest sees only their own; strangers none.
      const host = (await t.get('/v1/docs/stays?f.hostUid=alice&order=newest&limit=1', 'alice')).body;
      expect(host.items.map((s: Json) => s.id)).toEqual(['s2']); expect(host.next).toEqual(expect.any(Array));
      const more = (await t.get('/v1/docs/stays?f.hostUid=alice&order=newest&limit=1&after=' + encodeURIComponent(JSON.stringify(host.next)), 'alice')).body;
      expect(more.items.map((s: Json) => s.id)).toEqual(['s1']); expect(more.next).toBeNull();
      expect((await t.get('/v1/docs/stays?f.hostUid=alice', 'bob')).body.items.map((s: Json) => s.id)).toEqual(['s1']);
      expect((await t.get('/v1/docs/stays?f.hostUid=alice')).body.items).toEqual([]);
      expect((await t.get('/v1/docs/rays?f.holderUid=alice', 'alice')).body.items).toHaveLength(1);
      expect((await t.get('/v1/docs/rays?f.holderUid=alice', 'bob')).body.items).toHaveLength(0);
      // A capability token is fetched by anyone holding it; its list stays with the inviter.
      expect((await t.get('/v1/docs/network_invites?id=token1')).body.doc.email).toBe('x@y.z');
      expect((await t.get('/v1/docs/network_invites?f.email=x@y.z', 'bob')).body.items).toEqual([]);
      expect((await t.get('/v1/docs/network_invites?f.email=x@y.z', 'alice')).body.items).toHaveLength(1);
      // Malformed asks never reach the database.
      expect((await t.get('/v1/docs/stays?f.note=x', 'alice')).status).toBe(400);
      expect((await t.get('/v1/docs/nowhere?id=x', 'alice')).status).toBe(400);
      expect((await t.get('/v1/docs/stays?id=s1&f.uid=bob', 'alice')).status).toBe(400);
      expect((await t.get('/v1/docs/pulse_signatures?id=x', 'alice')).status).toBe(400);
    } finally { await t.close(); }
  });

  it('writes as a claim: own profile, frozen identity, the forest law, the circle law, the one ledger', async () => {
    const t = await serve();
    try {
      // Users: self-create, never inflate the allowance, spend it, never touch another's.
      expect((await t.post({ action: 'create', collection: 'users', id: 'alice', data: { uid: 'alice', displayName: 'Alice', invitesRemaining: 7, createdAt: { $op: 'serverTime' } } }, 'alice')).status).toBe(200);
      expect((await t.post({ action: 'update', collection: 'users', id: 'alice', patch: { invitesRemaining: 1_000_000 } }, 'alice')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'users', id: 'alice', patch: { invitesRemaining: 6, 'siteTheme.primary': '#123' } }, 'alice')).body.doc).toMatchObject({ invitesRemaining: 6, siteTheme: { primary: '#123' } });
      expect((await t.post({ action: 'set', collection: 'users', id: 'alice', merge: true, data: { desires: { tree: true } } }, 'bob')).status).toBe(403);
      expect((await t.post({ action: 'set', collection: 'users', id: 'alice', merge: true, data: { desires: { tree: true } } }, 'alice')).body.doc.desires).toEqual({ tree: true });
      // Persons: own creation with a true name; the lid is frozen; signing fields are the signing command's.
      expect((await t.post({ action: 'create', collection: 'persons', id: 'alice', data: { uid: 'alice', lid: '019a0000-0000-7000-8000-000000000001', displayName: 'Alice', publicKeyPem: null } }, 'alice')).status).toBe(200);
      expect((await t.post({ action: 'update', collection: 'persons', id: 'alice', patch: { lid: '019a0000-0000-7000-8000-000000000009' } }, 'alice')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'persons', id: 'alice', patch: { signingState: 'active' } }, 'alice')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'persons', id: 'alice', patch: { anonymous: true } }, 'alice')).body.doc.anonymous).toBe(true);
      expect((await t.post({ action: 'create', collection: 'persons', id: 'bob', data: { uid: 'bob' } }, 'alice')).status).toBe(403);
      // Trees: born with the planter's own anchor, unvalidated, at the root; a stranger cannot edit; the anchor cannot self-validate.
      const born = await t.post({ action: 'create', collection: 'lifetrees', id: 't1', data: { name: 'Oak', anchorUid: 'alice', treeType: 'LIFETREE', visibility: 'public', domain: 'node.example', genesisHash: 'g', latestHash: 'g', blockHeight: 0, validated: false, validatorId: null } }, 'alice');
      expect(born.status).toBe(200);
      expect((await t.post({ action: 'create', collection: 'lifetrees', id: 't2', data: { name: 'Forged', anchorUid: 'bob', treeType: 'LIFETREE' } }, 'alice')).status).toBe(403);
      expect((await t.post({ action: 'create', collection: 'lifetrees', id: 't3', data: { name: 'Claimed', anchorUid: 'alice', treeType: 'LIFETREE', validated: true, validatorId: 'alice' } }, 'alice')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'lifetrees', id: 't1', patch: { name: 'Great Oak', updatedAt: { $op: 'serverTime' } } }, 'alice')).body.doc.name).toBe('Great Oak');
      expect((await t.post({ action: 'update', collection: 'lifetrees', id: 't1', patch: { name: 'Mine' } }, 'bob')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'lifetrees', id: 't1', patch: { validated: true, validatorId: 'alice' } }, 'alice')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'lifetrees', id: 't1', patch: { latestHash: 'moved', blockHeight: 1 } }, 'alice')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'lifetrees', id: 't1', patch: { anchorUid: 'bob' } }, 'alice')).status).toBe(403);
      // A bed: domainless, at a real place or in a house; a secret tree born public is refused.
      expect((await t.post({ action: 'create', collection: 'lifetrees', id: 'bed1', data: { name: 'Bed', anchorUid: 'alice', treeType: 'BED', domain: '', latitude: 47.5, longitude: 19.0, visibility: 'node' } }, 'alice')).status).toBe(200);
      expect((await t.post({ action: 'create', collection: 'lifetrees', id: 'bed2', data: { name: 'Bed', anchorUid: 'alice', treeType: 'BED', domain: 'node.example', latitude: 47.5, longitude: 19.0 } }, 'alice')).status).toBe(403);
      expect((await t.post({ action: 'create', collection: 'lifetrees', id: 'bed3', data: { name: 'Nowhere', anchorUid: 'alice', treeType: 'BED', domain: '', latitude: 999, longitude: 0 } }, 'alice')).status).toBe(403);
      expect((await t.post({ action: 'create', collection: 'lifetrees', id: 'secret', data: { name: 'S', anchorUid: 'alice', treeType: 'SECRET', visibility: 'public' } }, 'alice')).status).toBe(403);
      // Love: one atomic gesture, the own slot readable by its holder alone, the tally public.
      expect((await t.post({ action: 'love', kind: 'lifetrees', id: 't1' }, 'bob')).body).toEqual({ loved: true, loveCount: 1 });
      expect((await t.post({ action: 'love', kind: 'lifetrees', id: 't1' }, 'alice')).body).toEqual({ loved: true, loveCount: 2 });
      expect((await t.post({ action: 'love', kind: 'lifetrees', id: 't1' }, 'bob')).body).toEqual({ loved: false, loveCount: 1 });
      expect((await t.get('/v1/docs/lifetree_loves?parent=t1&id=alice', 'alice')).status).toBe(200);
      expect((await t.get('/v1/docs/lifetree_loves?parent=t1&id=alice', 'bob')).status).toBe(404);
      expect((await t.get('/v1/docs/lifetrees?id=t1')).body.doc.loveCount).toBe(1);
      expect((await t.post({ action: 'create', collection: 'lifetree_loves', parent: 't1', id: 'carol', data: { uid: 'carol' } }, 'carol')).status).toBe(403);
      // The circle's decision: born standalone by a member; an outsider cannot even mark it seen; a hand appends only itself.
      t.sql(`INSERT INTO communities VALUES ('c1','{"name":"Circle","anchorUid":"alice","domain":"c.example","door":"invite"}');
        INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','member','c1','l1');`);
      const decision = { type: 'decision', communityId: 'c1', authorId: 'bob', proposedBy: 'bob', visibility: 'community', nature: 'general', title: 'T', body: '', previousHash: 'DECISION', hash: 'h', status: 'open', positions: [], createdAt: { $op: 'serverTime' } };
      expect((await t.post({ action: 'create', collection: 'pulses', id: 'd1', data: decision }, 'bob')).status).toBe(200);
      expect((await t.post({ action: 'create', collection: 'pulses', id: 'd2', data: { ...decision, authorId: 'alice' } }, 'bob')).status).toBe(403);
      expect((await t.post({ action: 'create', collection: 'pulses', id: 'd3', data: { ...decision, lifetreeId: 't1' } }, 'bob')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'pulses', id: 'd1', patch: { seenBy: { $op: 'arrayUnion', values: ['carol'] } } }, 'carol')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'pulses', id: 'd1', patch: { seenBy: { $op: 'arrayUnion', values: ['alice'] } } }, 'alice')).body.doc.seenBy).toEqual(['alice']);
      expect((await t.post({ action: 'update', collection: 'pulses', id: 'd1', patch: { seenBy: { $op: 'arrayUnion', values: ['bob'] } } }, 'alice')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'pulses', id: 'd1', patch: { title: 'Rewritten' } }, 'bob')).status).toBe(403);
      // A concern by a member enters listening; only the proposer, a keeper or staff lifts it; a passed decision never erases.
      expect((await t.post({ action: 'update', collection: 'pulses', id: 'd1', patch: { listening: true, concerns: [{ by: 'alice', note: 'wait', at: '2026-11-01T10:00:00.000Z' }] } }, 'alice')).status).toBe(200);
      expect((await t.post({ action: 'update', collection: 'pulses', id: 'd1', patch: { listening: false } }, 'carol')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'pulses', id: 'd1', patch: { listening: false } }, 'bob')).status).toBe(200);
      expect((await t.post({ action: 'update', collection: 'pulses', id: 'd1', patch: { status: 'withdrawn', withdrawnHash: 'w', withdrawnAt: { $op: 'serverTime' } }, expect: { status: 'open' } }, 'bob')).status).toBe(200);
      expect((await t.post({ action: 'update', collection: 'pulses', id: 'd1', patch: { status: 'open' }, expect: { status: 'open' } }, 'bob')).status).toBe(409);
      // A chain block is never deleted from a client; a standalone record by its author is.
      t.sql(`INSERT INTO pulses VALUES ('b1','{"type":"tree_growth","lifetreeId":"t1","authorId":"alice","hash":"h1","previousHash":"g","visibility":"public"}');`);
      expect((await t.post({ action: 'delete', collection: 'pulses', id: 'b1' }, 'alice')).status).toBe(403);
      expect((await t.post({ action: 'delete', collection: 'pulses', id: 'b1' }, 'staff')).status).toBe(403);
      expect((await t.post({ action: 'create', collection: 'pulses', id: 'e1', data: { type: 'event', title: 'Gathering', authorId: 'alice', domain: 'node.example', visibility: 'public', previousHash: 'EVENT', hash: 'e' } }, 'alice')).status).toBe(200);
      expect((await t.post({ action: 'delete', collection: 'pulses', id: 'e1' }, 'bob')).status).toBe(403);
      expect((await t.post({ action: 'delete', collection: 'pulses', id: 'e1' }, 'alice')).body).toEqual({ id: 'e1', doc: null });
      // Staff: named from governed records, never a claim.
      t.sql(`INSERT INTO admins VALUES ('staff','{}');`);
      expect((await t.post({ action: 'update', collection: 'lifetrees', id: 't1', patch: { validated: true, validatorId: 'staff' } }, 'staff')).status).toBe(200);
      expect((await t.post({ action: 'set', collection: 'config', id: 'limits', data: { maxLifetrees: 3 }, merge: true }, 'staff')).status).toBe(200);
      expect((await t.post({ action: 'set', collection: 'config', id: 'limits', data: { maxLifetrees: 300 }, merge: true }, 'alice')).status).toBe(403);
      expect((await t.get('/v1/docs/config?id=limits')).body.doc.maxLifetrees).toBe(3);
      expect((await t.get('/v1/docs/admins', 'alice')).body.items.map((a: Json) => a.id)).toEqual(['staff']);
      expect((await t.get('/v1/docs/admins')).body.items).toEqual([]);
    } finally { await t.close(); }
  });

  it('keeps a bed honest: a stay by its guest, answered by its host, mirrored as identity-free nights, never double-booked', async () => {
    const t = await serve();
    try {
      t.sql(`INSERT INTO lifetrees VALUES ('bed1','{"name":"Bed","anchorUid":"alice","treeType":"BED","visibility":"node","latitude":1,"longitude":2}');`);
      const stay = (uid: string, id: string, from: string, to: string, host = 'alice') =>
        t.post({ action: 'create', collection: 'stays', id, data: { uid, bedId: 'bed1', hostUid: host, fromDate: from, toDate: to, status: 'requested', nights: 2, lightHouseId: '', createdAt: { $op: 'serverTime' } } }, uid);
      expect((await stay('bob', 's1', '2026-12-01', '2026-12-03')).status).toBe(200);
      expect((await stay('bob', 's2', '2026-12-01', '2026-12-03', 'bob')).status).toBe(403);
      expect((await stay('bob', 's3', '2026-12-03', '2026-12-01')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'stays', id: 's1', patch: { status: 'accepted' } }, 'bob')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'stays', id: 's1', patch: { status: 'accepted', bedId: 'other' } }, 'alice')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'stays', id: 's1', patch: { status: 'accepted', updatedAt: { $op: 'serverTime' } } }, 'alice')).status).toBe(200);
      expect((await t.get('/v1/docs/lifetree_occupancy?parent=bed1')).body.items).toEqual([{ id: 's1', fromDate: '2026-12-01', toDate: '2026-12-03' }]);
      expect((await stay('carol', 's4', '2026-12-02', '2026-12-05')).status).toBe(200);
      expect((await t.post({ action: 'update', collection: 'stays', id: 's4', patch: { status: 'accepted' } }, 'alice')).body.error).toBe('stay_overlaps');
      expect((await t.post({ action: 'update', collection: 'stays', id: 's1', patch: { status: 'declined' } }, 'alice')).status).toBe(200);
      expect((await t.get('/v1/docs/lifetree_occupancy?parent=bed1')).body.items).toEqual([]);
      expect((await t.post({ action: 'update', collection: 'stays', id: 's4', patch: { status: 'accepted' } }, 'alice')).status).toBe(200);
      expect((await t.post({ action: 'delete', collection: 'stays', id: 's4' }, 'carol')).status).toBe(200);
      expect((await t.get('/v1/docs/lifetree_occupancy?parent=bed1')).body.items).toEqual([]);
      // A view-hold is one's own, near-future only; anyone signed in sees it.
      expect((await t.post({ action: 'set', collection: 'bed_holds', parent: 'bed1', id: 'bob', data: { holderUid: 'bob', expiresAt: Date.now() + 120_000 } }, 'bob')).status).toBe(200);
      expect((await t.post({ action: 'set', collection: 'bed_holds', parent: 'bed1', id: 'carol', data: { holderUid: 'carol', expiresAt: Date.now() + 120_000 } }, 'bob')).status).toBe(403);
      expect((await t.post({ action: 'set', collection: 'bed_holds', parent: 'bed1', id: 'bob', data: { holderUid: 'bob', expiresAt: Date.now() + 86_400_000 } }, 'bob')).status).toBe(403);
      expect((await t.get('/v1/docs/bed_holds?parent=bed1', 'carol')).body.items).toHaveLength(1);
      expect((await t.get('/v1/docs/bed_holds?parent=bed1')).body.items).toHaveLength(0);
    } finally { await t.close(); }
  });

  it('opens the doors that stand open: an invitation request from no one, a token consumed once, a letter subscribed', async () => {
    const t = await serve();
    try {
      expect((await t.post({ action: 'create', collection: 'invite_requests', data: { email: 'a@b.c', reason: 'r', status: 'pending', createdAt: { $op: 'serverTime' } } })).status).toBe(200);
      expect((await t.post({ action: 'create', collection: 'invite_requests', data: { email: 'a@b.c', reason: 'r', status: 'approved' } })).status).toBe(403);
      expect((await t.get('/v1/docs/invite_requests', 'alice')).body.items).toEqual([]);
      t.sql(`INSERT INTO admins VALUES ('staff','{}');`);
      expect((await t.get('/v1/docs/invite_requests', 'staff')).body.items).toHaveLength(1);
      expect((await t.post({ action: 'create', collection: 'network_invites', id: 'tok', data: { email: 'x@y.z', invitedByUserId: 'alice', status: 'pending', createdAt: { $op: 'serverTime' } } }, 'alice')).status).toBe(200);
      expect((await t.post({ action: 'create', collection: 'network_invites', id: 'tok2', data: { email: 'x@y.z', invitedByUserId: 'alice', status: 'pending' } }, 'bob')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'network_invites', id: 'tok', patch: { status: 'accepted', acceptedByUserId: 'bob', email: 'other@y.z' } }, 'bob')).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'network_invites', id: 'tok', patch: { status: 'accepted', acceptedByUserId: 'bob', acceptedAt: { $op: 'serverTime' } } }, 'bob')).status).toBe(200);
      expect((await t.post({ action: 'update', collection: 'network_invites', id: 'tok', patch: { status: 'accepted', acceptedByUserId: 'carol' } }, 'carol')).status).toBe(403);
      expect((await t.post({ action: 'set', collection: 'subscriptions', id: 'node.example__a@b.c', data: { email: 'a@b.c', domain: 'node.example', active: true, createdAt: { $op: 'serverTime' } }, merge: true })).status).toBe(200);
      expect((await t.post({ action: 'set', collection: 'subscriptions', id: 'node.example__c@b.c', data: { email: 'c@b.c', domain: 'node.example', active: true, unsubToken: 'mine' } })).status).toBe(403);
      expect((await t.post({ action: 'update', collection: 'subscriptions', id: 'node.example__a@b.c', patch: { active: false } }, 'bob')).status).toBe(403);
      expect((await t.post({ action: 'set', collection: 'subscriptions', id: 'node.example__bob', data: { uid: 'bob', email: 'bob@b.c', domain: 'node.example', active: true } }, 'bob')).status).toBe(200);
      expect((await t.post({ action: 'update', collection: 'subscriptions', id: 'node.example__bob', patch: { active: false } }, 'bob')).body.doc.active).toBe(false);
      expect((await t.get('/v1/docs/subscriptions?f.uid=bob', 'bob')).body.items).toHaveLength(1);
      expect((await t.get('/v1/docs/subscriptions?f.domain=node.example', 'alice')).body.items).toEqual([]);
      // Malformed commands are refused before the law is asked.
      expect((await t.post({ action: 'update', collection: 'users', id: 'alice', patch: {} }, 'alice')).status).toBe(400);
      expect((await t.post({ action: 'create', collection: 'users', id: 'alice', data: { id: 'x' } }, 'alice')).status).toBe(400);
      expect((await t.post({ action: 'create', collection: 'stays', parent: 'x', data: {} }, 'alice')).status).toBe(400);
      expect((await t.post({ action: 'update', collection: 'users', id: 'alice', patch: { '$op': 'x' } }, 'alice')).status).toBe(400);
    } finally { await t.close(); }
  });
});
