// THE ORGANS against real PostgreSQL (ring 2026-11-02): the server hands functions/src keeps for the
// origin node, asked through the API as the restricted runtime role — the witness kindles light, a
// receiver appreciates, a signed purchase spends the commons, the head is unminted with its touch
// lifted, the keeper lends staff hands, an account departs with its last spend, a community proves
// its anchor and claims a door by DNS the node observes itself. Every refusal the domain laws speak
// (judgeWitness, judgeAppreciation, judgeSpend, unmintRefusal, doorClaimRefusal) is met at the edge.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { startCluster, type Cluster } from './harness';
import { createApi } from '../../seed/api/server.mjs';
import { createAuthenticator } from '../../seed/api/auth.mjs';
import { authFixture } from './auth-fixture.mjs';
import { signingPreimage } from '../../src/domain/signing';
import { decisionIdentity, decisionSignaturePayload, DECISION_DOMAIN } from '../../src/domain/decision';

let cluster: Cluster;
beforeAll(() => { cluster = startCluster(55442); });
afterAll(() => cluster.stop());

type Json = Record<string, any>;
const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const serve = async (options: { faceDoors?: string[]; txt?: Record<string, string[][]> } = {}) => {
  const { db } = await cluster.fresh(3);
  const fixture = authFixture();
  fixture.config.bindings.push({ subject: 'issuer-carol', uid: 'carol' }, { subject: 'issuer-staff', uid: 'staff' });
  const txt = options.txt ?? {};
  const server = createApi(db, await createAuthenticator(fixture.config), { nodeDomain: 'node.example', faceDoors: options.faceDoors ?? [],
    resolveTxt: async (name: string) => { if (!txt[name]) throw new Error('ENOTFOUND'); return txt[name]; } });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing_address');
  const base = `http://127.0.0.1:${address.port}`;
  const tokens: Record<string, string> = { alice: fixture.token(), bob: fixture.token({ sub: 'issuer-bob' }), carol: fixture.token({ sub: 'issuer-carol' }), staff: fixture.token({ sub: 'issuer-staff' }) };
  const post = async (path: string, command: Json, who?: string) => {
    const r = await fetch(base + path, { method: 'POST', body: JSON.stringify(command), headers: { ...(who ? { authorization: 'Bearer ' + tokens[who] } : {}), 'content-type': 'application/json' } });
    return { status: r.status, body: await r.json() as Json };
  };
  const close = async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); };
  const doc = (table: string, id: string): Json | null => { const row = cluster.sql(`SELECT doc::text FROM ${table} WHERE id='${id}'`); return row ? JSON.parse(row) : null; };
  return { post, close, sql: cluster.sql, doc, txt };
};
// A living tree anchored by alice, its circle (bob a guardian since June), a watering alice minted on 1 November.
const forest = (sql: (q: string) => string) => sql(`
  INSERT INTO users VALUES ('alice','{"displayName":"Alice"}'),('bob','{"displayName":"Bob"}'),('carol','{"displayName":"Carol"}'),('staff','{"displayName":"Staff"}');
  INSERT INTO persons VALUES ('alice','{"uid":"alice","lid":"${LID(1)}","displayName":"Alice"}'),('bob','{"uid":"bob","lid":"${LID(2)}","displayName":"Bob"}'),
    ('carol','{"uid":"carol","lid":"${LID(3)}","displayName":"Carol"}'),('staff','{"uid":"staff","lid":"${LID(4)}","displayName":"Staff"}');
  INSERT INTO lifetrees VALUES ('t1','{"lid":"${LID(11)}","anchorUid":"alice","name":"Nur","treeType":"LIGHTTREE","visibility":"public","domain":"node.example","createdAt":"2026-01-01T00:00:00.000000Z","latestHash":"w1hash","blockHeight":1,"lastCaredAt":"2026-11-01T10:00:00.000000Z","watering":{"lastWateredAt":"2026-11-01T10:00:00.000000Z","lastWateredBy":"alice"}}');
  INSERT INTO links(from_id,rel,to_id,lid,created_at) VALUES ('bob','guardian','t1','${LID(61)}','2026-06-01T00:00:00Z'),('carol','guardian','t1','${LID(62)}','2026-11-02T00:00:00Z');
  INSERT INTO pulses VALUES ('w1','{"lid":"${LID(21)}","authorId":"alice","lifetreeId":"t1","type":"tree_growth","care":"watering","visibility":"public","wateringConfirmedBy":"pending","createdAt":"2026-11-01T10:00:00.000000Z","mintedAt":1793527200000,"hash":"w1hash","previousHash":"genesis","bearerBefore":{"lastCaredAt":null,"watering":{"lastWateredAt":null,"lastWateredBy":null}}}');`);

describe('the light organ', () => {
  it('the circle witnesses a watering: standing before the care, the day its own, rays born once and atomically', async () => {
    const t = await serve();
    try {
      forest(t.sql);
      // A stranger has no standing; the carer cannot witness itself; a guardian whose seat is younger than the watering is refused.
      expect((await t.post('/v1/light/command', { action: 'witness', pulseId: 'w1' }, 'staff')).body).toEqual({ error: 'forbidden' });
      expect((await t.post('/v1/light/command', { action: 'witness', pulseId: 'w1' }, 'alice')).status).toBe(409);
      expect((await t.post('/v1/light/command', { action: 'witness', pulseId: 'w1' }, 'carol')).status).toBe(409);
      expect((await t.post('/v1/light/command', { action: 'witness', pulseId: 'nowhere' }, 'bob')).body).toEqual({ error: 'watering_missing' });
      expect((await t.post('/v1/light/command', { action: 'witness', pulseId: 'w1' })).status).toBe(401);
      const kindled = await t.post('/v1/light/command', { action: 'witness', pulseId: 'w1' }, 'bob');
      expect(kindled.body).toEqual({ kindled: true, witnessUnits: 15 });
      expect(t.doc('rays', 't1__2026-11-01__carer')).toMatchObject({ holderUid: 'alice', role: 'carer', units: 108, sourceUid: 'alice', treeId: 't1', dayKey: '2026-11-01', pulseId: 'w1' });
      expect(t.doc('rays', 't1__2026-11-01__witness')).toMatchObject({ holderUid: 'bob', role: 'witness', units: 15 });
      expect(t.doc('pulses', 'w1')).toMatchObject({ wateringConfirmedBy: 'guardian', wateringConfirmation: { confirmedByUid: 'bob' } });
      // Witnessed is witnessed: the second hand finds it done, and mints nothing more.
      expect((await t.post('/v1/light/command', { action: 'witness', pulseId: 'w1' }, 'bob')).body).toEqual({ kindled: false, witnessUnits: 0, already: true });
      expect(t.sql('SELECT count(*) FROM rays')).toBe('2');
      // A witnessed watering can never be unminted (its light is already in the world).
      expect((await t.post('/v1/blocks/command', { action: 'unmint', pulseId: 'w1' }, 'alice')).body).toEqual({ error: 'unmint_witnessed' });
    } finally { await t.close(); }
  });

  it('a receiver appreciates once, oldest light first, the place takes its glow share, the rest waits at the offering', async () => {
    const t = await serve();
    try {
      forest(t.sql);
      t.sql(`INSERT INTO rays VALUES ('t1__2026-10-01__carer','{"holderUid":"alice","role":"carer","units":5,"treeId":"t1","dayKey":"2026-10-01","sourceUid":"alice"}'),
        ('t1__2026-10-20__carer','{"holderUid":"alice","role":"carer","units":108,"treeId":"t1","dayKey":"2026-10-20","sourceUid":"alice"}');
        INSERT INTO pulses VALUES ('off1','{"lid":"${LID(31)}","type":"offering","authorId":"bob","visibility":"public","offeringStatus":"accepted","offeringAnsweredBy":"alice","offeringActive":true,"createdAt":"2026-10-25T10:00:00.000000Z"}');`);
      // Only the hand that received the offering may appreciate it, in whole units it holds.
      expect((await t.post('/v1/light/command', { action: 'appreciate', offeringId: 'off1', units: 7 }, 'carol')).body).toEqual({ error: 'appreciate_not_received' });
      expect((await t.post('/v1/light/command', { action: 'appreciate', offeringId: 'off1', units: 7 }, 'bob')).body).toEqual({ error: 'gift_own_offering' });
      expect((await t.post('/v1/light/command', { action: 'appreciate', offeringId: 'off1', units: 2.5 }, 'alice')).body).toEqual({ error: 'gift_whole_units' });
      expect((await t.post('/v1/light/command', { action: 'appreciate', offeringId: 'off1', units: 500 }, 'alice')).body).toEqual({ error: 'gift_hold_less' });
      expect((await t.post('/v1/light/command', { action: 'appreciate', offeringId: 'gone', units: 1 }, 'alice')).status).toBe(404);
      expect((await t.post('/v1/light/command', { action: 'appreciate', offeringId: 'off1', units: 7 }, 'alice')).body).toEqual({ units: 7, glow: 1, suspended: 6 });
      // Oldest first: the 5 of October 1st, then 2 of the 20th. Conservation: 7 = 1 glow + 6 suspended.
      expect(t.doc('rays', 't1__2026-10-01__carer')!.units).toBe(0);
      expect(t.doc('rays', 't1__2026-10-20__carer')!.units).toBe(106);
      expect(t.doc('glow', 'NODE')!.units).toBe(1);
      expect(t.doc('pulses', 'off1')).toMatchObject({ offeringSuspendedLight: 6, offeringAppreciations: 1 });
      expect(t.doc('gifts', 'off1__alice')).toMatchObject({ giverUid: 'alice', units: 7, glow: 1, suspended: 6, glowHome: 'NODE', rays: [{ id: 't1__2026-10-01__carer', units: 5 }, { id: 't1__2026-10-20__carer', units: 2 }] });
      expect((await t.post('/v1/light/command', { action: 'appreciate', offeringId: 'off1', units: 1 }, 'alice')).body).toEqual({ error: 'appreciate_already' });
    } finally { await t.close(); }
  });

  it('the commons is spent only by a signed, passed purchase decision whose seal the node re-verifies, once', async () => {
    const t = await serve();
    try {
      forest(t.sql);
      const { publicKey, privateKey } = generateKeyPairSync('ed25519');
      const pubkey = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
      const fingerprint = createHash('sha256').update(pubkey, 'utf8').digest('hex');
      const identity = decisionIdentity({ lid: LID(41), communityId: 'c1', nature: 'purchase', title: 'Seeds for the garden', body: '', votesRequired: 1 });
      const sig = sign(null, Buffer.from(signingPreimage(DECISION_DOMAIN, decisionSignaturePayload(identity, 'alice')), 'utf8'), privateKey).toString('base64');
      t.sql(`UPDATE persons SET doc=doc||'{"publicKeyPem":"${pubkey}","signingKeyFingerprint":"${fingerprint}","signingState":"active"}' WHERE id='alice';
        INSERT INTO communities VALUES ('c1','{"lid":"${LID(51)}","name":"Garden","anchorUid":"alice","domain":"garden.example","createdAt":"2026-01-01T00:00:00.000000Z"}');
        INSERT INTO glow VALUES ('c1','{"units":10}');
        INSERT INTO pulses VALUES ('off1','{"lid":"${LID(31)}","type":"offering","authorId":"bob","visibility":"public","offeringStatus":"open","offeringActive":true,"createdAt":"2026-10-25T10:00:00.000000Z"}'),
          ('dec1','{"lid":"${LID(41)}","type":"decision","nature":"purchase","status":"passed","mode":"threshold","title":"Seeds for the garden","body":"","votesRequired":1,"communityId":"c1","proposedBy":"alice","spend":{"offeringId":"off1","units":7},"visibility":"community","createdAt":"2026-10-26T10:00:00.000000Z"}'),
          ('dec2','{"lid":"${LID(42)}","type":"decision","nature":"purchase","status":"passed","mode":"threshold","title":"Unsigned","body":"","votesRequired":1,"communityId":"c1","proposedBy":"alice","spend":{"offeringId":"off1","units":1},"visibility":"community","createdAt":"2026-10-26T11:00:00.000000Z"}');`);
      // Unsigned: the flipped status is not the seal.
      expect((await t.post('/v1/light/command', { action: 'spend', decisionId: 'dec2' }, 'alice')).body).toEqual({ error: 'spend_unsigned' });
      // A forged signature (another slot's) does not count either.
      t.sql(`INSERT INTO pulse_signatures VALUES ('dec1','bob','{"sig":"${sig}","pubkey":"${pubkey}","recordedAt":"2026-10-27T10:00:00.000000Z"}');`);
      expect((await t.post('/v1/light/command', { action: 'spend', decisionId: 'dec1' }, 'alice')).body).toEqual({ error: 'spend_unsigned' });
      t.sql(`INSERT INTO pulse_signatures VALUES ('dec1','alice','{"sig":"${sig}","pubkey":"${pubkey}","recordedAt":"2026-10-27T10:00:00.000000Z"}');`);
      // Only a hand that stands for the circle carries it out.
      expect((await t.post('/v1/light/command', { action: 'spend', decisionId: 'dec1' }, 'carol')).body).toEqual({ error: 'spend_no_standing' });
      expect((await t.post('/v1/light/command', { action: 'spend', decisionId: 'dec1' }, 'alice')).body).toEqual({ units: 7, glow: 1, suspended: 6, verifiedSigners: 1 });
      expect(t.doc('glow', 'c1')!.units).toBe(3);
      expect(t.doc('glow', 'NODE')!.units).toBe(1);
      expect(t.doc('spends', 'dec1')).toMatchObject({ decisionId: 'dec1', communityId: 'c1', offeringId: 'off1', units: 7, spentBy: 'alice', verifiedSigners: 1 });
      expect(t.doc('pulses', 'dec1')).toMatchObject({ spentBy: 'alice', spendId: 'dec1' });
      expect(t.doc('pulses', 'off1')).toMatchObject({ offeringSuspendedLight: 6, offeringAppreciations: 1 });
      expect((await t.post('/v1/light/command', { action: 'spend', decisionId: 'dec1' }, 'alice')).body).toEqual({ error: 'spend_already' });
      expect((await t.post('/v1/light/command', { action: 'spend', decisionId: 'dec3' }, 'alice')).status).toBe(404);
    } finally { await t.close(); }
  });

  it("the testing-phase reset empties every ray and glow, by the node's keeper alone", async () => {
    const t = await serve();
    try {
      forest(t.sql);
      t.sql(`INSERT INTO rays VALUES ('r1','{"holderUid":"alice","units":108}'),('r2','{"holderUid":"bob","units":15}'); INSERT INTO glow VALUES ('NODE','{"units":3}');
        INSERT INTO admins VALUES ('staff','{}'); INSERT INTO config VALUES ('superadmin','{"uid":"alice"}');`);
      expect((await t.post('/v1/light/command', { action: 'reset' }, 'staff')).status).toBe(403);
      expect((await t.post('/v1/light/command', { action: 'reset' }, 'alice')).body).toEqual({ rays: 2, rayUnits: 123, glowHomes: 1, glowUnits: 3 });
      expect(t.sql('SELECT count(*) FROM rays') + t.sql('SELECT count(*) FROM glow')).toBe('00');
    } finally { await t.close(); }
  });
});

describe('the unmint', () => {
  it("takes back only the author's own head, lifts the touch the mint left on the tree, and bends only for a staff hand where the law allows", async () => {
    const t = await serve();
    try {
      forest(t.sql);
      t.sql(`INSERT INTO admins VALUES ('staff','{}');
        INSERT INTO pulses VALUES ('g1','{"lid":"${LID(22)}","authorId":"alice","lifetreeId":"t1","type":"tree_growth","visibility":"public","createdAt":"2026-10-30T10:00:00.000000Z","hash":"genesis","previousHash":"0"}'),
        ('w0','{"lid":"${LID(23)}","authorId":"alice","lifetreeId":"t1","type":"tree_growth","care":"watering","visibility":"public","createdAt":"2026-10-31T10:00:00.000000Z","hash":"mid","previousHash":"genesis","loveCount":1}');`);
      // Below the head, never: the chain is not severed.
      expect((await t.post('/v1/blocks/command', { action: 'unmint', pulseId: 'w0' }, 'alice')).body).toEqual({ error: 'unmint_coheld' });
      expect((await t.post('/v1/blocks/command', { action: 'unmint', pulseId: 'w0' }, 'staff')).body).toEqual({ error: 'unmint_not_last' });
      expect((await t.post('/v1/blocks/command', { action: 'unmint', pulseId: 'w1' }, 'bob')).body).toEqual({ error: 'unmint_not_author' });
      expect((await t.post('/v1/blocks/command', { action: 'unmint', pulseId: 'gone' }, 'alice')).status).toBe(404);
      const unminted = (await t.post('/v1/blocks/command', { action: 'unmint', pulseId: 'w1' }, 'alice')).body;
      expect(unminted).toMatchObject({ latestHash: 'genesis', blockHeight: 0 });
      expect([...unminted.lifted].sort()).toEqual(['lastCaredAt', 'watering.lastWateredAt', 'watering.lastWateredBy']);
      expect(t.doc('pulses', 'w1')).toBeNull();
      const tree = t.doc('lifetrees', 't1')!;
      expect(tree).toMatchObject({ latestHash: 'genesis', blockHeight: 0 });
      expect(tree.lastCaredAt).toBeUndefined();
      expect(tree.watering).toEqual({});
      // The staff hand passes the social guards (authorship, co-holding) for a mend — never the structural ones.
      t.sql(`UPDATE lifetrees SET doc=doc||'{"latestHash":"mid","blockHeight":2}' WHERE id='t1';`);
      expect((await t.post('/v1/blocks/command', { action: 'unmint', pulseId: 'w0' }, 'staff')).body).toMatchObject({ latestHash: 'genesis', blockHeight: 1 });
      expect(t.sql("SELECT count(*) FROM pulses WHERE id IN ('w0','w1')")).toBe('0');
    } finally { await t.close(); }
  });
});

describe('the staff roster and the account', () => {
  it("the node's keeper is appointed by the installation and lends staff hands; admins cannot lend them on", async () => {
    const t = await serve();
    try {
      forest(t.sql);
      expect((await t.post('/v1/staff/command', { action: 'grant_admin', uid: 'bob' }, 'alice')).status).toBe(403);
      expect(t.sql("SELECT seed.appoint_keeper('alice', false)::text")).toContain('alice');
      expect(() => t.sql("SELECT seed.appoint_keeper('bob', false)")).toThrow(/LS059|keeper already stands/);
      expect(t.doc('config', 'superadmin')!.uid).toBe('alice');
      expect(t.doc('users', 'alice')!.invitesRemaining).toBe(144);
      expect((await t.post('/v1/staff/command', { action: 'grant_admin', uid: 'bob' }, 'alice')).body).toEqual({ uid: 'bob', admin: true });
      expect((await t.post('/v1/staff/command', { action: 'grant_admin', uid: 'nobody' }, 'alice')).status).toBe(404);
      expect(t.doc('admins', 'bob')).toMatchObject({ grantedBy: 'alice' });
      expect((await t.post('/v1/staff/command', { action: 'grant_admin', uid: 'carol' }, 'bob')).status).toBe(403);
      expect((await t.post('/v1/staff/command', { action: 'revoke_admin', uid: 'bob' }, 'alice')).body).toEqual({ uid: 'bob', admin: false });
      expect(t.doc('admins', 'bob')).toBeNull();
      expect(t.sql("SELECT seed.appoint_keeper('bob', true)::text")).toContain('bob');
    } finally { await t.close(); }
  });

  it('an account departs in one ceremony: the last spend to its heir through the prism, then every record and the login binding', async () => {
    const t = await serve();
    try {
      forest(t.sql);
      t.sql(`INSERT INTO rays VALUES ('t1__2026-09-01__carer','{"holderUid":"bob","role":"carer","units":108,"treeId":"t1","dayKey":"2026-09-01","sourceUid":"bob","communityId":"c1"}'),
        ('t1__2026-09-01__witness','{"holderUid":"alice","role":"witness","units":15,"treeId":"t1","dayKey":"2026-09-01","sourceUid":"bob"}');
        INSERT INTO lifetrees VALUES ('t2','{"lid":"${LID(12)}","anchorUid":"bob","name":"Bobs","treeType":"LIGHTTREE","visibility":"public","createdAt":"2026-02-01T00:00:00.000000Z"}');
        INSERT INTO pulses VALUES ('pb','{"lid":"${LID(24)}","authorId":"bob","lifetreeId":"t2","type":"tree_growth","visibility":"public","createdAt":"2026-02-02T00:00:00.000000Z"}');
        INSERT INTO admins VALUES ('staff','{}'); INSERT INTO config VALUES ('superadmin','{"uid":"carol"}');`);
      // A stranger has no staff hand; an admin may not delete the keeper or a fellow admin; the heir must be another being.
      expect((await t.post('/v1/account/command', { action: 'delete_as_staff', uid: 'alice' }, 'bob')).status).toBe(403);
      expect((await t.post('/v1/account/command', { action: 'delete_as_staff', uid: 'carol' }, 'staff')).status).toBe(403);
      expect((await t.post('/v1/account/command', { action: 'delete_mine', heirUid: 'bob' }, 'bob')).status).toBe(404);
      expect((await t.post('/v1/account/command', { action: 'delete_mine', heirUid: 'alice' }, 'bob')).body).toMatchObject({ deleted: true, lifetrees: 1, pulses: 1, links: 1, rays: 1, unitsToHeir: 93, unitsToGlow: 15 });
      expect(t.doc('rays', 't1__2026-09-01__carer')).toMatchObject({ holderUid: 'alice', units: 93, sourceUid: 'departed' });
      expect(t.doc('rays', 't1__2026-09-01__witness')).toMatchObject({ holderUid: 'alice', sourceUid: 'departed' });
      expect(t.doc('glow', 'c1')!.units).toBe(15);
      expect(t.doc('persons', 'bob')).toBeNull(); expect(t.doc('users', 'bob')).toBeNull(); expect(t.doc('lifetrees', 't2')).toBeNull(); expect(t.doc('pulses', 'pb')).toBeNull();
      expect(t.sql("SELECT count(*) FROM links WHERE from_id='bob'")).toBe('0');
      // The staff hand deletes an ordinary account: no heir, the light dissolves into its place.
      t.sql(`INSERT INTO rays VALUES ('t1__2026-09-02__carer','{"holderUid":"alice","role":"carer","units":10,"treeId":"t1","dayKey":"2026-09-02","sourceUid":"alice"}');`);
      expect((await t.post('/v1/account/command', { action: 'delete_as_staff', uid: 'alice' }, 'staff')).body).toMatchObject({ deleted: true, unitsToHeir: 0 });
      // Each ray dissolves into its own place: the inherited carer ray into c1, the placeless ones into the node.
      expect(t.doc('glow', 'c1')!.units).toBe(15 + 93);
      expect(t.doc('glow', 'NODE')!.units).toBe(15 + 10);
      expect(t.sql("SELECT count(*) FROM rays")).toBe('0');
    } finally { await t.close(); }
  });
});

describe('the anchor and the doors', () => {
  it('a keeper proves the anchor by a TXT record the node observes; the mark is the server\'s alone and the challenge resumes while it lives', async () => {
    const t = await serve();
    try {
      forest(t.sql);
      t.sql(`INSERT INTO communities VALUES ('c1','{"lid":"${LID(51)}","name":"Garden","anchorUid":"alice","domain":"garden.example","createdAt":"2026-01-01T00:00:00.000000Z"}'),
        ('c2','{"lid":"${LID(52)}","name":"Bare","anchorUid":"bob","createdAt":"2026-01-01T00:00:00.000000Z"}');`);
      expect((await t.post('/v1/domains/command', { action: 'start_verification', communityId: 'c1' }, 'bob')).status).toBe(403);
      expect((await t.post('/v1/domains/command', { action: 'start_verification', communityId: 'c9' }, 'alice')).status).toBe(404);
      expect((await t.post('/v1/domains/command', { action: 'start_verification', communityId: 'c2' }, 'bob')).body).toEqual({ error: 'no_domain' });
      expect((await t.post('/v1/domains/command', { action: 'check_verification', communityId: 'c1' }, 'alice')).body).toEqual({ error: 'no_challenge' });
      const first = (await t.post('/v1/domains/command', { action: 'start_verification', communityId: 'c1' }, 'alice')).body;
      expect(first).toMatchObject({ domain: 'garden.example', recordName: '_lightseed-challenge.garden.example' });
      expect(first.recordValue).toMatch(/^lightseed-verification=v1:[a-f0-9]{32}$/);
      expect((await t.post('/v1/domains/command', { action: 'start_verification', communityId: 'c1' }, 'alice')).body).toEqual(first);
      expect((await t.post('/v1/domains/command', { action: 'check_verification', communityId: 'c1' }, 'alice')).body).toEqual({ error: 'txt_not_found' });
      t.txt['_lightseed-challenge.garden.example'] = [['lightseed-verification=v1:' + 'f'.repeat(32)]];
      expect((await t.post('/v1/domains/command', { action: 'check_verification', communityId: 'c1' }, 'alice')).body).toEqual({ error: 'txt_mismatch' });
      t.txt['_lightseed-challenge.garden.example'] = [['other'], [first.recordValue.slice(0, 20), first.recordValue.slice(20)]];
      expect((await t.post('/v1/domains/command', { action: 'check_verification', communityId: 'c1' }, 'alice')).body).toEqual({ verified: true, domain: 'garden.example' });
      expect(t.doc('communities', 'c1')!.domainVerification).toMatchObject({ domain: 'garden.example', method: 'dns_txt' });
      expect(t.sql('SELECT count(*) FROM seed.domain_challenges')).toBe('0');
    } finally { await t.close(); }
  });

  it('a door is claimed by proof or granted by the steward, never taken from another place, and its beings come home', async () => {
    const t = await serve({ faceDoors: ['faces.example'] });
    try {
      forest(t.sql);
      t.sql(`INSERT INTO communities VALUES ('c1','{"lid":"${LID(51)}","name":"Garden","anchorUid":"alice","domain":"garden.example","createdAt":"2026-01-01T00:00:00.000000Z"}'),
        ('c2','{"lid":"${LID(52)}","name":"Other","anchorUid":"bob","domain":"other.example","domainAliases":["taken.example"],"createdAt":"2026-01-01T00:00:00.000000Z"}');
        INSERT INTO pulses VALUES ('pd','{"lid":"${LID(25)}","authorId":"carol","type":"reach","visibility":"public","domain":"door.example","createdAt":"2026-03-01T00:00:00.000000Z"}');
        INSERT INTO admins VALUES ('staff','{}');`);
      const start = (door: string, who = 'alice', communityId = 'c1') => t.post('/v1/domains/command', { action: 'start_door', communityId, door }, who);
      expect((await start('not a host')).body).toEqual({ error: 'door_not_hostname' });
      expect((await start('node.example')).body).toEqual({ error: 'door_is_node' });
      expect((await start('garden.example')).body).toEqual({ error: 'door_is_domain' });
      expect((await start('other.example')).body).toEqual({ error: 'door_taken' });
      expect((await start('taken.example')).body).toEqual({ error: 'door_taken' });
      expect((await start('door.example', 'bob')).status).toBe(403);
      const claim = (await start('https://Door.example/')).body;
      expect(claim).toMatchObject({ door: 'door.example', kind: 'custom', recordName: '_lightseed-challenge.door.example' });
      expect((await start('door.example')).body).toEqual(claim);
      expect((await start('faces.example')).body).toEqual({ door: 'faces.example', kind: 'face' });
      expect((await t.post('/v1/domains/command', { action: 'list_doors', communityId: 'c1' }, 'alice')).body.claims).toEqual([
        { door: 'door.example', kind: 'custom', recordName: claim.recordName, recordValue: claim.recordValue }, { door: 'faces.example', kind: 'face' }]);
      expect((await t.post('/v1/domains/command', { action: 'list_doors', communityId: 'c1' }, 'bob')).status).toBe(403);
      // The proof, then the door opens and the being stamped with it comes home.
      expect((await t.post('/v1/domains/command', { action: 'check_door', communityId: 'c1', door: 'faces.example' }, 'alice')).body).toEqual({ error: 'no_challenge' });
      t.txt['_lightseed-challenge.door.example'] = [[claim.recordValue]];
      expect((await t.post('/v1/domains/command', { action: 'check_door', communityId: 'c1', door: 'door.example' }, 'alice')).body).toEqual({ claimed: true, door: 'door.example', moved: 1 });
      expect(t.doc('communities', 'c1')!.domainAliases).toEqual(['door.example']);
      expect(t.doc('pulses', 'pd')!.domain).toBe('garden.example');
      expect((await start('door.example')).body).toEqual({ error: 'door_already' });
      expect((await start('door.example', 'bob', 'c2')).body).toEqual({ error: 'door_taken' });
      // A face door is the steward's grant (staff hand door_grant), never a keeper's proof; a custom door is never granted.
      expect((await t.post('/v1/domains/command', { action: 'grant_door', communityId: 'c1', door: 'faces.example' }, 'alice')).status).toBe(403);
      expect((await t.post('/v1/domains/command', { action: 'grant_door', communityId: 'c1', door: 'other2.example' }, 'staff')).body).toEqual({ error: 'door_not_face' });
      t.sql(`INSERT INTO config VALUES ('staffHands','{"door_grant":false}');`);
      expect((await t.post('/v1/domains/command', { action: 'grant_door', communityId: 'c1', door: 'faces.example' }, 'staff')).status).toBe(403);
      t.sql(`DELETE FROM config WHERE id='staffHands';`);
      expect((await t.post('/v1/domains/command', { action: 'grant_door', communityId: 'c1', door: 'faces.example' }, 'staff')).body).toEqual({ claimed: true, door: 'faces.example', moved: 0 });
      expect(t.doc('communities', 'c1')!.domainAliases).toEqual(['door.example', 'faces.example']);
      expect((await t.post('/v1/domains/command', { action: 'list_doors', communityId: 'c1' }, 'alice')).body.claims).toEqual([]);
      expect((await t.post('/v1/domains/command', { action: 'withdraw_door', communityId: 'c1', door: 'door.example' }, 'alice')).body).toEqual({ withdrawn: true, door: 'door.example' });
      expect(t.doc('communities', 'c1')!.domainAliases).toEqual(['faces.example']);
    } finally { await t.close(); }
  });
});
