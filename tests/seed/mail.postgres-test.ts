// THE MAIL ORGAN against real PostgreSQL (ring 2026-11-03): letters leave the independent node the
// way the origin's Trigger Email extension and Cloud Functions send them — a system letter composed
// by the node in the voice of its place under a daily quota, the letter of a place fanned out one per
// subscriber with its own unsubscribe door, a reach's notice and push knock throttled by thread, a join
// request's knock on the keepers, an accepted invitation's links minted in the acceptance itself, a
// stranger's request for an invitation, the welcome of a first profile and the address a verified
// login carries — through the API as the restricted runtime role, carried by a courier whose SMTP and
// push are stand-ins that remember what they were handed.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startCluster, type Cluster } from './harness';
import { createApi } from '../../seed/api/server.mjs';
import { createAuthenticator } from '../../seed/api/auth.mjs';
import { createMailOrgan, smtpTransportOptions } from '../../seed/api/mail.mjs';
import { authFixture } from './auth-fixture.mjs';

let cluster: Cluster;
beforeAll(() => { cluster = startCluster(55444); });
afterAll(() => cluster.stop());

type Json = Record<string, any>;
const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const UUID7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const charter = { ...JSON.parse(readFileSync(resolve('seed/node.example.json'), 'utf8')), nodeLid: LID(900), push: { subject: 'mailto:keeper@node.example', publicKey: 'B'.repeat(87) } };

const serve = async (options: { transport?: boolean; push?: boolean; organ?: boolean } = {}) => {
  const { db } = await cluster.fresh(3);
  const fixture = authFixture();
  fixture.config.bindings.push({ subject: 'issuer-carol', uid: 'carol' }, { subject: 'issuer-staff', uid: 'staff' }, { subject: 'issuer-dave', uid: 'dave' });
  const sent: Json[] = []; const knocks: Json[] = []; let failing: ((letter: Json) => boolean) | null = null; const dead = new Set<string>();
  const transport = options.transport === false ? null : { sendMail: async (letter: Json) => { if (failing?.(letter)) throw new Error('ECONNREFUSED'); sent.push(letter); return { messageId: 'm' }; } };
  const push = options.push === false ? null : { send: async (subscription: Json, notice: Json) => { if (dead.has(subscription.endpoint)) throw Object.assign(new Error('gone'), { statusCode: 410 }); knocks.push({ endpoint: subscription.endpoint, notice }); } };
  const organ = options.organ === false ? null : createMailOrgan({ charter, nodeOrigin: 'https://app.node.example', transport, push, log: { warn: () => undefined } });
  const courier = organ?.createCourier(db.withSession) ?? null;
  const server = createApi(db, await createAuthenticator(fixture.config, undefined, db.recordEmail), { nodeDomain: 'node.example', mail: organ });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing_address');
  const base = `http://127.0.0.1:${address.port}`;
  const tokens: Record<string, string> = { alice: fixture.token(), bob: fixture.token({ sub: 'issuer-bob' }), carol: fixture.token({ sub: 'issuer-carol' }), staff: fixture.token({ sub: 'issuer-staff' }), dave: fixture.token({ sub: 'issuer-dave' }) };
  const headers = (who?: string, token?: string): Record<string, string> => (token ? { authorization: 'Bearer ' + token } : who ? { authorization: 'Bearer ' + tokens[who] } : {});
  const post = async (path: string, command: Json | null, who?: string, token?: string) => {
    const r = await fetch(base + path, { method: 'POST', body: command ? JSON.stringify(command) : undefined, headers: { ...headers(who, token), ...(command ? { 'content-type': 'application/json' } : {}) } });
    const text = await r.text(); let body: Json | string = text; try { body = JSON.parse(text) as Json; } catch { /* html */ }
    return { status: r.status, body: body as Json, text, type: r.headers.get('content-type') ?? '' };
  };
  const get = async (path: string, who?: string, token?: string) => { const r = await fetch(base + path, { headers: headers(who, token) }); const text = await r.text(); let body: Json | string = text; try { body = JSON.parse(text) as Json; } catch { /* html */ } return { status: r.status, body: body as Json, text }; };
  const mail = (command: Json, who?: string) => post('/v1/mail/command', command, who);
  const doc = (command: Json, who: string) => post('/v1/docs/command', command, who);
  const tick = async () => { if (!courier) throw new Error('no courier'); const report = await courier.tick(); if (!report) throw new Error('courier_busy'); return report; };
  const close = async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); };
  const rows = (q: string): Json[] => { const out = cluster.sql(`SELECT coalesce(json_agg(r),'[]') FROM (${q}) r;`); return JSON.parse(out) as Json[]; };
  return { post, get, mail, doc, tick, close, sql: cluster.sql, rows, sent, knocks, dead, fail: (f: ((letter: Json) => boolean) | null) => { failing = f; }, tokens, fixture };
};
const people = (sql: (q: string) => string) => sql(`
  INSERT INTO users VALUES ('alice','{"displayName":"Alice","email":"alice@x.y","invitesRemaining":7}'),('bob','{"displayName":"Bob","email":"bob@x.y"}'),
    ('carol','{"displayName":"Carol","email":"carol@x.y","emailNotifications":{"directMessages":false}}'),('staff','{"displayName":"Staff","email":"staff@x.y"}'),('dave','{"displayName":"Dave"}');
  INSERT INTO persons VALUES ('alice','{"uid":"alice","lid":"${LID(1)}","displayName":"Alice"}'),('bob','{"uid":"bob","lid":"${LID(2)}","displayName":"Bob"}'),
    ('carol','{"uid":"carol","lid":"${LID(3)}","displayName":"Carol","anonymous":true}'),('staff','{"uid":"staff","lid":"${LID(4)}","displayName":"Staff"}'),('dave','{"uid":"dave","lid":"${LID(5)}","displayName":"Dave"}');
  INSERT INTO admins VALUES ('staff','{}');
  INSERT INTO communities VALUES ('c1','{"lid":"${LID(31)}","name":"The O House","anchorUid":"alice","domain":"theohouse.org","door":"invite","createdAt":"2026-01-01T00:00:00.000000Z",
    "theme":{"primary":"#7B9476","text":"#504243","background":"#FEF8F3"},"mail":{"greeting":"Dear friend,","signature":"With gratitude,\\nThe O House","footer":"The O House · a garden"}}'),
    ('c2','{"lid":"${LID(32)}","name":"Example node","anchorUid":"alice","domain":"node.example","door":"open","createdAt":"2026-01-02T00:00:00.000000Z"}');`);

describe('the system letter', () => {
  it('is composed by the node in the voice of the door, counted against the day, carried and settled by the courier, its delivery the sender\'s to see', async () => {
    const t = await serve();
    try {
      people(t.sql);
      // Refusals: the law's bad link; a shape the validator never admits.
      expect((await t.mail({ action: 'send_system', to: 'bob@x.y', text: 'hi', ctaUrl: 'javascript:alert(1)' }, 'alice')).body).toEqual({ error: 'mail_bad_link' });
      expect((await t.mail({ action: 'send_system', to: ['a@b.co', 'c@d.co', 'e@f.co', 'g@h.co', 'i@j.co', 'k@l.co'], text: 'hi' }, 'alice')).body).toEqual({ error: 'invalid_command' });
      expect((await t.mail({ action: 'send_system', to: 'bob@x.y', text: 'hi' })).status).toBe(401);
      // A letter at the node's own door speaks as the node; at a place's door, in the place's voice and name.
      const bare = await t.mail({ action: 'send_system', to: 'bob@x.y', subject: 'Hello', text: 'Plain <words>', ctaUrl: 'https://app.node.example/i/abc', ctaLabel: 'Accept', domain: 'node.example' }, 'alice');
      expect(bare.status).toBe(200); expect(bare.body.success).toBe(true); expect(bare.body.id).toMatch(UUID7);
      const dressed = await t.mail({ action: 'send_system', to: ['bob@x.y'], subject: 'Knock', text: 'A knock', domain: 'theohouse.org' }, 'alice');
      expect(dressed.status).toBe(200);
      const queued = t.rows(`SELECT id, uid, doc, delivery FROM seed.mail ORDER BY created_at`);
      expect(queued).toHaveLength(2);
      expect(queued[0]).toMatchObject({ uid: 'alice', delivery: { state: 'PENDING', attempts: 0 }, doc: { to: ['bob@x.y'], from: 'Example <hello@node.example>', subject: 'Hello' } });
      expect(queued[0].doc.html).toContain('Plain &lt;words&gt;'); expect(queued[0].doc.html).toContain('href="https://app.node.example/i/abc"'); expect(queued[0].doc.html).toContain('>Example node</h2>');
      expect(queued[0].doc.text).toBe('Plain <words>\n\nhttps://app.node.example/i/abc');
      expect(queued[1].doc.from).toBe('Example - The O House <hello@node.example>');
      expect(queued[1].doc.html).toContain('Dear friend,<br><br>A knock<br><br>With gratitude,<br>The O House'); expect(queued[1].doc.html).toContain('color: #7b9476');
      // The delivery: the sender's and staff's to see, no one else's.
      expect((await t.mail({ action: 'status', id: bare.body.id }, 'alice')).body).toEqual({ delivery: { state: 'PENDING', attempts: 0 } });
      expect((await t.mail({ action: 'status', id: bare.body.id }, 'bob')).body).toEqual({ error: 'mail_missing' });
      expect((await t.mail({ action: 'status', id: bare.body.id }, 'staff')).status).toBe(200);
      // The courier carries both; the second is refused by the SMTP stand-in and waits, counted.
      t.fail(letter => letter.subject === 'Knock');
      let report = await t.tick();
      expect(report).toMatchObject({ letters: 0, delivered: 1, retried: 1, failed: 0 });
      expect(t.sent.map(l => [l.to, l.subject, l.from])).toEqual([[['bob@x.y'], 'Hello', 'Example <hello@node.example>']]);
      expect((await t.mail({ action: 'status', id: bare.body.id }, 'alice')).body.delivery).toMatchObject({ state: 'SUCCESS', attempts: 1 });
      const waiting = t.rows(`SELECT delivery, (next_attempt_at > now()) AS later FROM seed.mail WHERE id='${dressed.body.id}'`)[0];
      expect(waiting.delivery).toMatchObject({ state: 'PENDING', attempts: 1, error: 'ECONNREFUSED' }); expect(waiting.later).toBe(true);
      // Not due yet: the courier leaves it. Due with the patience spent: it gives up out loud.
      expect((await t.tick()).delivered + (await t.tick()).retried).toBe(0);
      t.sql(`UPDATE seed.mail SET next_attempt_at=now(), delivery=delivery||'{"attempts":4}' WHERE id='${dressed.body.id}'`);
      report = await t.tick();
      expect(report).toMatchObject({ failed: 1 });
      expect((await t.mail({ action: 'status', id: dressed.body.id }, 'alice')).body.delivery).toMatchObject({ state: 'ERROR', attempts: 5, error: 'ECONNREFUSED' });
      t.fail(null);
      // The day's quota: twenty for a hand, none for staff.
      for (let i = 2; i < 20; i++) expect((await t.mail({ action: 'send_system', to: 'bob@x.y', text: 'n' + i }, 'alice')).status).toBe(200);
      expect((await t.mail({ action: 'send_system', to: 'bob@x.y', text: 'over' }, 'alice'))).toMatchObject({ status: 429, body: { error: 'mail_quota' } });
      expect(t.rows(`SELECT counters FROM seed.usage WHERE uid='alice'`)[0].counters).toEqual({ dailyEmail: 20 });
      expect(t.rows(`SELECT count(*) AS n FROM seed.mail WHERE doc->>'subject'='A message from Example node' AND doc->>'text'='over'`)[0].n).toBe(0);
      for (let i = 0; i < 21; i++) expect((await t.mail({ action: 'send_system', to: 'bob@x.y', text: 's' + i }, 'staff')).status).toBe(200);
      expect(t.rows(`SELECT count(*) AS n FROM seed.usage WHERE uid='staff'`)[0].n).toBe(0);
    } finally { await t.close(); }
  });
  it('refuses by name when the installation has no courier or no charter, and the SMTP URL law admits TLS alone', async () => {
    const silent = await serve({ transport: false });
    try {
      people(silent.sql);
      expect(await silent.mail({ action: 'send_system', to: 'bob@x.y', text: 'hi' }, 'alice')).toMatchObject({ status: 503, body: { error: 'mail_unavailable' } });
      expect(await silent.mail({ action: 'send_newsletter', communityId: 'c1', subject: 's', html: '<p>h</p>' }, 'alice')).toMatchObject({ status: 503, body: { error: 'mail_unavailable' } });
      expect((await silent.mail({ action: 'status', id: 'nothing' }, 'alice')).body).toEqual({ error: 'mail_missing' });
    } finally { await silent.close(); }
    const bare = await serve({ organ: false });
    try {
      people(bare.sql);
      expect(await bare.mail({ action: 'send_system', to: 'bob@x.y', text: 'hi' }, 'alice')).toMatchObject({ status: 503, body: { error: 'mail_unavailable' } });
      expect(await bare.mail({ action: 'status', id: 'x' }, 'alice')).toMatchObject({ status: 404, body: { error: 'mail_missing' } });
    } finally { await bare.close(); }
    expect(smtpTransportOptions('smtps://ann%40x.y:p%40ss@smtp.example')).toEqual({ host: 'smtp.example', port: 465, secure: true, auth: { user: 'ann@x.y', pass: 'p@ss' } });
    expect(smtpTransportOptions('smtp://relay.internal:2525')).toEqual({ host: 'relay.internal', port: 2525, secure: false, requireTLS: true });
    expect(smtpTransportOptions('smtp://mailpit:1025?plaintext=true')).toEqual({ host: 'mailpit', port: 1025, secure: false, ignoreTLS: true });
    expect(() => smtpTransportOptions('smtp://mailpit:1025?plaintext=yes')).toThrow(/smtps/);
    expect(() => smtpTransportOptions('http://smtp.example')).toThrow(/smtps/);
    expect(() => smtpTransportOptions('smtp://smtp.example/path')).toThrow(/smtps/);
    expect(() => createMailOrgan({ charter: { ...charter, nodeLid: 'nope' }, transport: null })).toThrow(/charter/);
  });
});

describe('the letter of a place', () => {
  it('fans one letter out per subscriber at the place under the keeper\'s or the node staff\'s hand, each with its own unsubscribe door, and stamps the place', async () => {
    const t = await serve();
    try {
      people(t.sql);
      t.sql(`INSERT INTO subscriptions VALUES ('s1','{"email":"ann@x.y","domain":"theohouse.org","active":true,"uid":"bob"}'),
        ('s2','{"email":"ben@x.y","domain":"theohouse.org","active":true,"unsubToken":"tok_existing_000000"}'),
        ('s3','{"email":"cal@x.y","domain":"theohouse.org","active":false}'),('s4','{"email":"dan@x.y","domain":"elsewhere.org","active":true}'),
        ('s5','{"email":"ann@x.y","domain":"theohouse.org","active":true}'),('s6','{"email":"eve@x.y","domain":"node.example","active":true,"uid":"carol"}');`);
      expect(await t.mail({ action: 'send_newsletter', communityId: 'c1', subject: 'News', html: '<p>Hello</p>' }, 'bob')).toMatchObject({ status: 403, body: { error: 'forbidden' } });
      expect(await t.mail({ action: 'send_newsletter', communityId: 'c1', subject: 'News', html: '<p>Hello</p>' }, 'staff')).toMatchObject({ status: 403, body: { error: 'newsletter_not_keeper' } });
      expect(await t.mail({ action: 'send_newsletter', communityId: 'nowhere', subject: 'News', html: '<p>Hello</p>' }, 'alice')).toMatchObject({ status: 404, body: { error: 'community_missing' } });
      expect(await t.mail({ action: 'send_newsletter', communityId: 'c1', subject: '', html: '<p>Hello</p>' }, 'alice')).toMatchObject({ status: 400 });
      const sent = await t.mail({ action: 'send_newsletter', communityId: 'c1', subject: 'News', html: '<p>Hello</p>' }, 'alice');
      expect(sent).toMatchObject({ status: 200, body: { sent: 2 } });
      const letters = t.rows(`SELECT uid, doc FROM seed.mail ORDER BY doc->>'to'`);
      expect(letters.map(l => [l.doc.to, l.uid, l.doc.from])).toEqual([[['ann@x.y'], 'bob', 'Example - The O House <hello@node.example>'], [['ben@x.y'], null, 'Example - The O House <hello@node.example>']]);
      const token = t.rows(`SELECT doc->>'unsubToken' AS token FROM subscriptions WHERE id='s1'`)[0].token;
      expect(token).toMatch(/^[0-9a-f]{32}$/);
      expect(letters[0].doc.headers).toEqual({ 'List-Unsubscribe': `<https://app.node.example/u/${token}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
      expect(letters[0].doc.html).toBe(`<p>Hello</p><hr style="border:0;border-top:1px solid #eee;margin:28px 0;"/><p style="font-size:12px;color:#9ca3af;line-height:1.6;">You're receiving this because you subscribed to the letter of The O House.<br/><a href="https://app.node.example/u/${token}" style="color:#7b9476;">Unsubscribe</a> · The O House · a garden</p>`);
      expect(letters[1].doc.headers['List-Unsubscribe']).toBe('<https://app.node.example/u/tok_existing_000000>');
      expect(t.rows(`SELECT doc->>'unsubToken' AS token FROM subscriptions WHERE id='s5'`)[0].token).toBeNull(); // the duplicate address is not written to twice
      expect(t.rows(`SELECT doc FROM communities WHERE id='c1'`)[0].doc).toMatchObject({ newsletterLastSubject: 'News', newsletterLastSent: 2 });
      expect(t.rows(`SELECT count(*) AS n FROM config WHERE id='newsletter'`)[0].n).toBe(0);
      // The node's own place: staff may send, and the node's stamp moves too.
      expect(await t.mail({ action: 'send_newsletter', communityId: 'c2', subject: 'Node news', html: '<p>N</p>' }, 'staff')).toMatchObject({ status: 200, body: { sent: 1 } });
      expect(t.rows(`SELECT doc FROM config WHERE id='newsletter'`)[0].doc).toMatchObject({ lastSubject: 'Node news', lastSent: 1 });
      expect(t.rows(`SELECT doc->>'from' AS f FROM seed.mail WHERE doc->>'subject'='Node news'`)[0].f).toBe('Example <hello@node.example>');
      // No audience: the letter has no one to go to.
      t.sql(`UPDATE subscriptions SET doc=doc||'{"active":false}' WHERE id IN ('s1','s2','s5')`);
      expect(await t.mail({ action: 'send_newsletter', communityId: 'c1', subject: 'News', html: '<p>Hello</p>' }, 'alice')).toMatchObject({ status: 409, body: { error: 'newsletter_no_subscribers' } });
      // One-click release by token alone: the subscription rests, the profile's switch follows; a POST never fails; an unknown token is a plain 404 page.
      const node = t.rows(`SELECT doc->>'unsubToken' AS token FROM subscriptions WHERE id='s6'`)[0].token;
      const page = await t.get(`/u/${node}`);
      expect(page.status).toBe(200); expect(page.text).toContain('You have been unsubscribed'); expect(page.text).toContain('Example node');
      expect(t.rows(`SELECT doc FROM subscriptions WHERE id='s6'`)[0].doc).toMatchObject({ active: false });
      expect(t.rows(`SELECT doc FROM users WHERE id='carol'`)[0].doc).toMatchObject({ newsletterPlaces: { 'node.example': false }, newsletterSubscribed: false });
      expect((await t.post(`/u/${'z'.repeat(20)}`, null)).status).toBe(200);
      expect((await t.get(`/u/${'z'.repeat(20)}`)).status).toBe(404);
      expect((await t.get('/u/short')).status).toBe(404);
      const carried = await t.tick();
      expect(carried.delivered).toBe(3);
      expect(t.sent.find(l => l.to[0] === 'ann@x.y')?.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    } finally { await t.close(); }
  });
});

describe('the effects of a write', () => {
  it('a reach writes to its recipients in the voice of its place, once per quiet thread, and knocks on their devices, dropping the dead ones', async () => {
    const t = await serve();
    try {
      people(t.sql);
      t.sql(`INSERT INTO seed.push_subscriptions VALUES ('bob','d1','{"endpoint":"https://push.example/bob","keys":{"p256dh":"p","auth":"a"}}'),
        ('dave','d2','{"endpoint":"https://push.example/dave-gone","keys":{"p256dh":"p","auth":"a"}}'),('alice','d3','{"endpoint":"https://push.example/alice","keys":{"p256dh":"p","auth":"a"}}');`);
      t.dead.add('https://push.example/dave-gone');
      const reach = (over: Json) => t.doc({ action: 'create', collection: 'pulses', data: { lid: LID(21), type: 'reach', authorId: 'alice', authorName: "Alice's oak", visibility: 'private', previousHash: 'PERSON_REACH', content: 'Shall we <align>?', domain: 'theohouse.org', ...over } }, 'alice');
      // A 1:1 reach to bob, a group reach to bob, carol (opted out) and dave (no address, a dead device).
      expect((await reach({ recipientUid: 'bob', recipientName: "Bob's pine", threadId: 't1' })).status).toBe(200);
      expect((await reach({ lid: LID(22), participantUids: ['alice', 'bob', 'carol', 'dave'], threadId: 'g1', threadName: 'The circle', isGroup: true, content: 'All of you' })).status).toBe(200);
      expect(t.rows(`SELECT kind, ref FROM seed.outbox ORDER BY id`).map(r => r.kind)).toEqual(['reach', 'reach']);
      const report = await t.tick();
      expect(report).toMatchObject({ effects: 2, letters: 2, delivered: 2 });
      const letters = t.sent.map(l => ({ to: l.to, subject: l.subject, from: l.from }));
      expect(letters).toEqual(expect.arrayContaining([
        { to: ['bob@x.y'], subject: "Alice's oak sent Bob's pine a direct message on Example node", from: 'Example - The O House <hello@node.example>' },
        { to: ['bob@x.y'], subject: "Alice's oak messaged The circle on Example node", from: 'Example - The O House <hello@node.example>' }]));
      expect(t.sent[0].html).toContain('Shall we &lt;align&gt;?'); expect(t.sent[0].html).toContain('Dear friend,'); expect(t.sent[0].text).toContain('Open your messages: https://theohouse.org');
      expect(t.rows(`SELECT uid FROM seed.mail ORDER BY id`).map(r => r.uid)).toEqual(['bob', 'bob']);
      expect(t.rows(`SELECT id FROM seed.mail_throttle ORDER BY id`).map(r => r.id)).toEqual(['bob__g1', 'bob__t1']);
      // Knocks: bob's device twice, dave's dead device once then dropped, the author's never.
      expect(t.knocks.map(k => k.endpoint)).toEqual(['https://push.example/bob', 'https://push.example/bob']);
      expect(t.knocks[0].notice).toEqual({ title: "Alice's oak", body: 'Shall we <align>?', url: 'https://theohouse.org/', tag: 't1' });
      expect(t.rows(`SELECT uid, id FROM seed.push_subscriptions ORDER BY uid`)).toEqual([{ uid: 'alice', id: 'd3' }, { uid: 'bob', id: 'd1' }]);
      // A second message in the same thread within the window: no letter, still a knock.
      expect((await reach({ lid: LID(23), recipientUid: 'bob', threadId: 't1', content: 'And again' })).status).toBe(200);
      expect(await t.tick()).toMatchObject({ effects: 1, letters: 0 });
      expect(t.knocks).toHaveLength(3);
      // The window has passed: the thread is quiet again.
      t.sql(`UPDATE seed.mail_throttle SET last_sent_at=now()-interval '11 minutes' WHERE id='bob__t1'`);
      expect((await reach({ lid: LID(24), recipientUid: 'bob', threadId: 't1', content: 'Later' })).status).toBe(200);
      expect(await t.tick()).toMatchObject({ effects: 1, letters: 1 });
      // A stale effect is retired, never delivered late; an effect whose pulse is gone is done.
      t.sql(`INSERT INTO seed.outbox(kind,ref,created_at) VALUES ('reach','nowhere',now()-interval '2 days'),('reach','nowhere',now())`);
      expect(await t.tick()).toMatchObject({ effects: 2, letters: 0 });
      expect(t.rows(`SELECT outcome FROM seed.outbox WHERE ref='nowhere' ORDER BY id`).map(r => r.outcome)).toEqual(['stale', 'done']);
      expect(t.rows(`SELECT count(*) AS n FROM seed.outbox WHERE done_at IS NULL`)[0].n).toBe(0);
    } finally { await t.close(); }
  });
  it('a join request knocks on the anchor and the stewards by the requester\'s public name; an accepted invitation mints its links in the acceptance itself', async () => {
    const t = await serve();
    try {
      people(t.sql);
      t.sql(`INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','steward','c1','${LID(61)}');
        INSERT INTO lifetrees VALUES ('t1','{"lid":"${LID(11)}","anchorUid":"carol","name":"Nur","treeType":"LIGHTTREE","visibility":"public"}');`);
      expect((await t.post('/v1/communities/command', { action: 'request', id: 'c1' }, 'carol')).body).toMatchObject({ requested: true });
      expect(t.rows(`SELECT kind, ref FROM seed.outbox`)).toEqual([{ kind: 'join_request', ref: 'carol__join_request__c1' }]);
      expect(await t.tick()).toMatchObject({ effects: 1, letters: 2, delivered: 2 });
      expect(t.sent.map(l => [l.to[0], l.subject]).sort()).toEqual([['alice@x.y', 'Nur asked to join The O House'], ['bob@x.y', 'Nur asked to join The O House']]);
      expect(t.sent[0].html).toContain(">Open Example node</a>"); expect(t.sent[0].text).toContain("You can accept or decline on the community's Members tab.\n\nWith gratitude,\nThe O House\n\nhttps://app.node.example");
      expect(t.rows(`SELECT uid FROM seed.mail ORDER BY uid`).map(r => r.uid)).toEqual(['alice', 'bob']);
      // A network invitation from the anchor of c1, accepted by dave: welcomed_by, member and invited_by, each with a true name.
      t.sql(`INSERT INTO network_invites VALUES ('n1','{"email":"dave@x.y","invitedByUserId":"alice","status":"pending","nodeCommunityId":"c1","nodeDomain":"theohouse.org"}'),
        ('n2','{"email":"dave@x.y","invitedByUserId":"carol","status":"pending","nodeCommunityId":"c1","nodeDomain":"theohouse.org"}');`);
      expect((await t.doc({ action: 'update', collection: 'network_invites', id: 'n1', patch: { status: 'accepted', acceptedByUserId: 'dave', acceptedAt: { $op: 'serverTime' } } }, 'dave')).status).toBe(200);
      const minted = t.rows(`SELECT id, lid, doc FROM links WHERE from_id='dave' ORDER BY rel`);
      expect(minted.map(l => l.id)).toEqual(['dave__invited_by__c1', 'dave__member__c1', 'dave__welcomed_by__alice']);
      for (const l of minted) expect(l.lid).toMatch(UUID7);
      expect(minted[1].doc).toEqual({ type: 'link', inviteId: 'n1', invitedBy: 'alice' }); expect(minted[2].doc).toEqual({ type: 'link', inviteId: 'n1' });
      // The escalation guard: carol does not belong to c1, so her invitation welcomes but grants no membership.
      t.sql(`DELETE FROM links WHERE from_id='dave'`);
      expect((await t.doc({ action: 'update', collection: 'network_invites', id: 'n2', patch: { status: 'accepted', acceptedByUserId: 'dave', acceptedAt: { $op: 'serverTime' } } }, 'dave')).status).toBe(200);
      expect(t.rows(`SELECT id FROM links WHERE from_id='dave'`).map(l => l.id)).toEqual(['dave__welcomed_by__carol']);
      // The lid the soil mints is a UUIDv7 that moves with time.
      const [a, b] = [t.sql('SELECT seed.lid()'), t.sql('SELECT seed.lid()')];
      expect(a).toMatch(UUID7); expect(b).toMatch(UUID7); expect(a < b || a.slice(0, 12) === b.slice(0, 12)).toBe(true);
    } finally { await t.close(); }
  });
  it('a stranger asks for an invitation once; a verified login\'s address is remembered and the first profile is welcomed', async () => {
    const t = await serve();
    try {
      t.sql(`INSERT INTO network_invites VALUES ('n1','{"email":"invited@x.y","invitedByUserId":"alice","status":"pending"}');`);
      expect((await t.post('/v1/invite-requests', { email: 'Ask@X.Y', reason: 'I would like to plant' })).body).toEqual({ status: 'created' });
      expect((await t.post('/v1/invite-requests', { email: 'ask@x.y', reason: 'again' })).body).toEqual({ status: 'already_requested' });
      expect((await t.post('/v1/invite-requests', { email: 'invited@x.y' })).body).toEqual({ status: 'pending_invite_exists' });
      expect((await t.post('/v1/invite-requests', { email: 'nope' })).status).toBe(400);
      expect((await t.get('/v1/invite-requests')).status).toBe(405);
      expect(t.rows(`SELECT doc FROM invite_requests`)[0].doc).toMatchObject({ email: 'ask@x.y', reason: 'I would like to plant', status: 'pending' });
      // The address rides only in a token the issuer verified; an unverified claim is not remembered.
      const unverified = t.fixture.token({ email: 'alice@x.y', email_verified: false });
      expect((await t.get('/v1/me', undefined, unverified)).status).toBe(200);
      expect(t.rows(`SELECT count(*) AS n FROM users WHERE id='alice'`)[0].n).toBe(0);
      const verified = t.fixture.token({ email: 'Alice@X.Y', email_verified: true });
      expect((await t.get('/v1/me', undefined, verified)).status).toBe(200);
      expect(t.rows(`SELECT doc FROM users WHERE id='alice'`)[0].doc).toEqual({ uid: 'alice', email: 'alice@x.y' });
      // The first profile: the person is born, the welcome follows, and the shell sees the address beside the profile.
      const saved = await t.post('/v1/me/profile', { displayName: 'Alice' }, undefined, verified);
      expect(saved.status).toBe(200); expect(saved.body.email).toBe('alice@x.y'); expect(saved.body.profile.displayName).toBe('Alice');
      expect((await t.get('/v1/me/profile', undefined, verified)).body.email).toBe('alice@x.y');
      expect(t.rows(`SELECT kind, ref FROM seed.outbox`)).toEqual([{ kind: 'welcome', ref: 'alice' }]);
      expect(await t.tick()).toMatchObject({ effects: 1, letters: 1, delivered: 1 });
      expect(t.sent[0]).toMatchObject({ to: ['alice@x.y'], subject: 'Welcome to Example node', from: 'Example <hello@node.example>' });
      expect(t.sent[0].text).toBe('Welcome to Example node, Alice. You have planted your intention. Now you may plant your tree.');
      // A second save is no second birth.
      expect((await t.post('/v1/me/profile', { displayName: 'Alice B' }, undefined, verified)).status).toBe(200);
      expect(t.rows(`SELECT count(*) AS n FROM seed.outbox`)[0].n).toBe(1);
      // Rows imported by the owner's hand (no session) leave no effect behind.
      t.sql(`INSERT INTO persons VALUES ('bob','{"uid":"bob","lid":"${LID(2)}","displayName":"Bob"}');
        INSERT INTO pulses VALUES ('p9','{"lid":"${LID(29)}","type":"reach","authorId":"bob","recipientUid":"alice","visibility":"private"}');`);
      expect(t.rows(`SELECT count(*) AS n FROM seed.outbox`)[0].n).toBe(1);
    } finally { await t.close(); }
  });
});
