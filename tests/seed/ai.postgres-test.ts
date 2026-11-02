// THE AI ORGAN against real PostgreSQL (ring 2026-11-03): a model asked on a hand's behalf the way the
// origin's generateAIContent / generateClaudeContent answer — the node's own key a member benefit gated
// by the dial and counted by the day, a kept credential opened for one call only for a hand entitled to
// spend it, every provider failure spoken by name — and a provider key kept as ciphertext the soil cannot
// read, mirrored onto an intelligence its author owns. The rails are stand-ins that remember what they
// were handed; the API runs as the restricted runtime role.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { startCluster, type Cluster } from './harness';
import { createApi } from '../../seed/api/server.mjs';
import { createAuthenticator } from '../../seed/api/auth.mjs';
import { createAiOrgan, createCredentialCipher } from '../../seed/api/ai.mjs';
import { authFixture } from './auth-fixture.mjs';

let cluster: Cluster;
beforeAll(() => { cluster = startCluster(55445); });
afterAll(() => cluster.stop());

type Json = Record<string, any>;
const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const SECRET = randomBytes(32).toString('base64');

const serve = async (options: { organ?: boolean; cipher?: boolean; nodeKeys?: Record<string, string | null> } = {}) => {
  const { db } = await cluster.fresh(3);
  const fixture = authFixture();
  fixture.config.bindings.push({ subject: 'issuer-carol', uid: 'carol' }, { subject: 'issuer-staff', uid: 'staff' }, { subject: 'issuer-dave', uid: 'dave' }, { subject: 'issuer-eve', uid: 'eve' });
  const asks: Json[] = []; let failing: Json | null = null; let answer: Json = { text: 'a reply' };
  const rail = (provider: string) => ({ complete: async (ask: Json) => { asks.push({ provider, ...ask }); if (failing) throw failing; return answer; } });
  const cipher = options.cipher === false ? null : createCredentialCipher(SECRET);
  const nodeKeys = options.nodeKeys ?? { google: 'node-google', anthropic: 'node-anthropic' };
  const organ = options.organ === false ? null : createAiOrgan({ rails: { google: rail('google'), anthropic: rail('anthropic') }, cipher, nodeKeys, log: { warn: () => undefined } });
  const server = createApi(db, await createAuthenticator(fixture.config), { nodeDomain: 'node.example', ai: organ });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing_address');
  const base = `http://127.0.0.1:${address.port}`;
  const tokens: Record<string, string> = { alice: fixture.token(), bob: fixture.token({ sub: 'issuer-bob' }), carol: fixture.token({ sub: 'issuer-carol' }), staff: fixture.token({ sub: 'issuer-staff' }), dave: fixture.token({ sub: 'issuer-dave' }), eve: fixture.token({ sub: 'issuer-eve' }) };
  const ai = async (command: Json, who: string) => {
    const r = await fetch(base + '/v1/ai/command', { method: 'POST', body: JSON.stringify(command), headers: { authorization: 'Bearer ' + tokens[who], 'content-type': 'application/json' } });
    return { status: r.status, body: await r.json() as Json };
  };
  const close = async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); };
  const rows = (q: string): Json[] => JSON.parse(cluster.sql(`SELECT coalesce(json_agg(r),'[]') FROM (${q}) r;`)) as Json[];
  return { ai, close, sql: cluster.sql, rows, asks, cipher, fail: (f: Json | null) => { failing = f; }, answer: (a: Json) => { answer = a; } };
};
// alice anchors a validated tree; bob anchors the community c1 (unvalidated); carol is an initiate; dave is a member of c1; eve is nobody; staff is staff.
const people = (sql: (q: string) => string) => sql(`
  INSERT INTO users VALUES ('alice','{"displayName":"Alice"}'),('bob','{"displayName":"Bob"}'),('carol','{"displayName":"Carol"}'),('dave','{"displayName":"Dave"}'),('eve','{"displayName":"Eve"}'),('staff','{"displayName":"Staff"}');
  INSERT INTO admins VALUES ('staff','{}');
  INSERT INTO initiates VALUES ('carol','{"handle":"carol"}');
  INSERT INTO lifetrees VALUES ('t1','{"lid":"${LID(11)}","anchorUid":"alice","name":"Nur","treeType":"LIGHTTREE","visibility":"public","validated":true}'),
    ('t2','{"lid":"${LID(12)}","anchorUid":"bob","name":"Bud","treeType":"LIGHTTREE","visibility":"public"}');
  INSERT INTO communities VALUES ('c1','{"lid":"${LID(31)}","name":"The O House","anchorUid":"bob","domain":"theohouse.org","door":"invite","createdAt":"2026-01-01T00:00:00.000000Z"}');
  INSERT INTO links(from_id,rel,to_id,lid) VALUES ('dave','member','c1','${LID(61)}');
  INSERT INTO intelligences VALUES ('i-alice','{"lid":"${LID(71)}","name":"Alice''s Claude","authorId":"alice","provider":"anthropic","model":"claude-sonnet-5","enabled":true,"public":false}'),
    ('i-c1','{"lid":"${LID(72)}","name":"House Claude","authorId":"bob","provider":"anthropic","model":"claude-sonnet-5","enabled":true,"public":true,"credentialScope":"community","credentialHolderUid":"c1"}');`);

describe('the node\'s own key', () => {
  it('is a member benefit the dial opens, counted by the day for texts and pictures apart, uncounted for staff, and absent when the node holds none', async () => {
    const t = await serve();
    try {
      people(t.sql);
      const ask = { action: 'generate', provider: 'google', messages: [{ role: 'model', text: 'hello' }, { role: 'user', text: 'hi' }], system: 'Be kind.' };
      // Nobody: the node's key is not theirs.
      expect(await t.ai(ask, 'eve')).toEqual({ status: 403, body: { error: 'ai_validated_only' } });
      expect(t.asks.length).toBe(0);
      // The dial off: everyone signed in; the rail sees the node's key, the default model, the voice and the transcript as the law shapes it.
      t.sql(`INSERT INTO config VALUES ('limits','{"nodeAiValidatedOnly":false}');`);
      const open = await t.ai(ask, 'eve');
      expect(open).toEqual({ status: 200, body: { text: 'a reply', source: 'node' } });
      expect(t.asks[0]).toEqual({ provider: 'google', apiKey: 'node-google', model: 'gemini-3.5-flash', system: 'Be kind.', messages: [{ role: 'model', text: 'hello' }, { role: 'user', text: 'hi' }], json: false, image: false });
      expect(t.rows(`SELECT uid, counters FROM seed.usage`)).toEqual([{ uid: 'eve', counters: { dailyAiText: 1 } }]);
      t.sql(`UPDATE config SET doc='{"nodeAiValidatedOnly":true}' WHERE id='limits';`);
      expect((await t.ai(ask, 'eve')).status).toBe(403);
      // A validated tree's anchor and an initiate pass the gate; the day's limit is the origin's 21.
      for (let i = 0; i < 21; i++) expect((await t.ai({ ...ask, json: true, model: 'gemini-3.5-flash' }, 'alice')).status).toBe(200);
      expect(await t.ai(ask, 'alice')).toEqual({ status: 429, body: { error: 'ai_quota' } });
      expect(t.asks.at(-1)).toMatchObject({ json: true });
      expect((await t.ai(ask, 'carol')).status).toBe(200);
      // Pictures draw on their own allowance of 3 — by the image ask or by an image model's name — and come back as a data URL.
      t.answer({ text: 'a caption', image: 'data:image/png;base64,QUJD' });
      expect(await t.ai({ ...ask, image: true }, 'alice')).toEqual({ status: 200, body: { text: 'a caption', image: 'data:image/png;base64,QUJD', source: 'node' } });
      expect((await t.ai({ ...ask, model: 'gemini-2.5-flash-image' }, 'alice')).status).toBe(200);
      expect((await t.ai({ ...ask, image: true }, 'alice')).status).toBe(200);
      expect(await t.ai({ ...ask, image: true }, 'alice')).toEqual({ status: 429, body: { error: 'ai_quota' } });
      expect(t.rows(`SELECT counters FROM seed.usage WHERE uid='alice'`)).toEqual([{ counters: { dailyAiText: 21, dailyAiImage: 3 } }]);
      // Staff are gated by nothing and counted nowhere.
      for (let i = 0; i < 25; i++) expect((await t.ai(ask, 'staff')).status).toBe(200);
      expect(t.rows(`SELECT 1 FROM seed.usage WHERE uid='staff'`)).toEqual([]);
      // Claude on the node's key, the transcript already shaped; and no key at all answers before the gate.
      t.answer({ text: 'claude says' });
      expect(await t.ai({ ...ask, provider: 'anthropic', model: 'claude-sonnet-5' }, 'carol')).toEqual({ status: 200, body: { text: 'claude says', source: 'node' } });
      expect(t.asks.at(-1)).toMatchObject({ provider: 'anthropic', apiKey: 'node-anthropic', model: 'claude-sonnet-5' });
    } finally { await t.close(); }
    const u = await serve({ nodeKeys: { google: 'node-google', anthropic: null } });
    try {
      people(u.sql);
      expect(await u.ai({ action: 'generate', provider: 'anthropic', messages: [{ role: 'user', text: 'hi' }] }, 'eve')).toEqual({ status: 412, body: { error: 'ai_key_missing' } });
      expect(u.rows(`SELECT 1 FROM seed.usage`)).toEqual([]);
    } finally { await u.close(); }
  });
});

describe('a kept key', () => {
  it('rests as ciphertext, is mirrored onto an intelligence its author owns, opens for one call only for a hand entitled to spend it, and leaves without a trace', async () => {
    const t = await serve();
    try {
      people(t.sql);
      // Bob (unvalidated) keeps his own key and names his own intelligence? No — i-alice is Alice's: the row is kept, the mirror refused.
      const kept = await t.ai({ action: 'save_credential', scope: 'user', holderId: 'bob', provider: 'anthropic', key: 'sk-ant-bob-secret-7788', intelligenceId: 'i-alice' }, 'bob');
      expect(kept).toEqual({ status: 200, body: { connected: true, keyHint: '…7788' } });
      const row = t.rows(`SELECT id, scope, holder_id, provider, ciphertext, key_id, key_hint, updated_by FROM seed.provider_credentials`)[0];
      expect(row).toMatchObject({ id: 'user_bob_anthropic', scope: 'user', holder_id: 'bob', provider: 'anthropic', key_hint: '…7788', updated_by: 'bob', key_id: t.cipher!.keyId });
      expect(row.ciphertext).not.toContain('sk-ant');
      expect(t.cipher!.open(row.ciphertext, 'user_bob_anthropic', row.key_id)).toBe('sk-ant-bob-secret-7788');
      expect(t.rows(`SELECT doc->'connected' AS connected FROM intelligences WHERE id='i-alice'`)).toEqual([{ connected: null }]);
      // Bob spends his own key: no gate, no count, the rail sees the plaintext.
      const ask = { action: 'generate', provider: 'anthropic', messages: [{ role: 'user', text: 'hi' }], credential: { scope: 'user', holderId: 'bob' } };
      expect(await t.ai(ask, 'bob')).toEqual({ status: 200, body: { text: 'a reply', source: 'byo' } });
      expect(t.asks.at(-1)).toMatchObject({ apiKey: 'sk-ant-bob-secret-7788' });
      expect(t.rows(`SELECT 1 FROM seed.usage`)).toEqual([]);
      // Eve names Bob's key: not hers, so the node's key answers — and the gate refuses her, in silence about the key.
      expect(await t.ai(ask, 'eve')).toEqual({ status: 403, body: { error: 'ai_validated_only' } });
      // Alice names Bob's key: not hers either; her validated tree admits her to the node's key.
      expect(await t.ai(ask, 'alice')).toEqual({ status: 200, body: { text: 'a reply', source: 'node' } });
      expect(t.asks.at(-1)).toMatchObject({ apiKey: 'node-anthropic' });
      // A community's key: its anchor keeps it (mirrored onto the house intelligence he authored), a member spends it, a stranger does not, a member may not keep it, staff may.
      expect(await t.ai({ action: 'save_credential', scope: 'community', holderId: 'c1', provider: 'anthropic', key: 'sk-ant-house-key-1234', intelligenceId: 'i-c1' }, 'dave')).toEqual({ status: 403, body: { error: 'forbidden' } });
      expect(await t.ai({ action: 'save_credential', scope: 'community', holderId: 'c1', provider: 'anthropic', key: 'sk-ant-house-key-1234', intelligenceId: 'i-c1' }, 'bob')).toEqual({ status: 200, body: { connected: true, keyHint: '…1234' } });
      expect(t.rows(`SELECT doc->>'connected' AS c, doc->>'keyHint' AS h, doc->>'credentialScope' AS s, doc->>'credentialHolderUid' AS u FROM intelligences WHERE id='i-c1'`)).toEqual([{ c: 'true', h: '…1234', s: 'community', u: 'c1' }]);
      const house = { action: 'generate', provider: 'anthropic', messages: [{ role: 'user', text: 'hi' }], credential: { scope: 'community', holderId: 'c1' } };
      expect(await t.ai(house, 'dave')).toEqual({ status: 200, body: { text: 'a reply', source: 'byo' } });
      expect(t.asks.at(-1)).toMatchObject({ apiKey: 'sk-ant-house-key-1234' });
      expect(await t.ai(house, 'eve')).toEqual({ status: 403, body: { error: 'ai_validated_only' } });
      expect(await t.ai({ action: 'save_credential', scope: 'community', holderId: 'c1', provider: 'google', key: 'AIza-house-google-5555' }, 'staff')).toEqual({ status: 200, body: { connected: true, keyHint: '…5555' } });
      // Rotation keeps one row; removal deletes it and clears the mirror.
      expect(await t.ai({ action: 'save_credential', scope: 'community', holderId: 'c1', provider: 'anthropic', key: 'sk-ant-house-key-9999', intelligenceId: 'i-c1' }, 'bob')).toEqual({ status: 200, body: { connected: true, keyHint: '…9999' } });
      expect(t.rows(`SELECT count(*)::int AS n FROM seed.provider_credentials WHERE id='community_c1_anthropic'`)).toEqual([{ n: 1 }]);
      expect(await t.ai({ action: 'save_credential', scope: 'community', holderId: 'c1', provider: 'anthropic', key: '', intelligenceId: 'i-c1' }, 'bob')).toEqual({ status: 200, body: { connected: false } });
      expect(t.rows(`SELECT 1 FROM seed.provider_credentials WHERE id='community_c1_anthropic'`)).toEqual([]);
      expect(t.rows(`SELECT doc->>'connected' AS c, doc ? 'keyHint' AS h FROM intelligences WHERE id='i-c1'`)).toEqual([{ c: 'false', h: false }]);
      // A row sealed under another installation's key will not open: the node's key answers instead (and a warning is logged).
      t.sql(`UPDATE seed.provider_credentials SET key_id='0000000000000000' WHERE id='user_bob_anthropic';`);
      expect(await t.ai(ask, 'bob')).toEqual({ status: 403, body: { error: 'ai_validated_only' } });
    } finally { await t.close(); }
  });
});

describe('the refusals', () => {
  it('speak by name: no organ, no cipher, an unknown provider, a rejected key, a rate limit, a plain failure, and a malformed ask', async () => {
    const none = await serve({ organ: false });
    try {
      people(none.sql);
      expect(await none.ai({ action: 'generate', provider: 'google', messages: [{ role: 'user', text: 'hi' }] }, 'alice')).toEqual({ status: 503, body: { error: 'ai_unavailable' } });
    } finally { await none.close(); }
    const bare = await serve({ cipher: false });
    try {
      people(bare.sql);
      expect(await bare.ai({ action: 'save_credential', scope: 'user', holderId: 'alice', provider: 'anthropic', key: 'sk-ant-x-1234' }, 'alice')).toEqual({ status: 503, body: { error: 'credentials_unavailable' } });
      // A credential named where none can be kept: the node's key answers.
      expect(await bare.ai({ action: 'generate', provider: 'google', messages: [{ role: 'user', text: 'hi' }], credential: { scope: 'user', holderId: 'alice' } }, 'alice')).toEqual({ status: 200, body: { text: 'a reply', source: 'node' } });
    } finally { await bare.close(); }
    const t = await serve();
    try {
      people(t.sql);
      const ask = { action: 'generate', provider: 'google', messages: [{ role: 'user', text: 'hi' }] };
      t.fail({ status: 401, message: 'invalid x-api-key' });
      expect(await t.ai(ask, 'alice')).toEqual({ status: 403, body: { error: 'ai_key_rejected' } });
      t.fail({ message: '[400 Bad Request] API key not valid. Please pass a valid API key. [reason: API_KEY_INVALID]' });
      expect(await t.ai(ask, 'alice')).toEqual({ status: 403, body: { error: 'ai_key_rejected' } });
      t.fail({ status: 429, message: 'rate limited' });
      expect(await t.ai(ask, 'alice')).toEqual({ status: 429, body: { error: 'ai_rate_limited' } });
      t.fail(new Error('socket hang up'));
      expect(await t.ai(ask, 'alice')).toEqual({ status: 502, body: { error: 'ai_failed' } });
      t.fail(null);
      // The day was still counted for each attempt, as the origin counts before it calls.
      expect(t.rows(`SELECT counters FROM seed.usage WHERE uid='alice'`)).toEqual([{ counters: { dailyAiText: 4 } }]);
      for (const bad of [
        { action: 'generate', provider: 'openai', messages: [{ role: 'user', text: 'hi' }] },
        { action: 'generate', provider: 'google', messages: [] },
        { action: 'generate', provider: 'google', messages: [{ role: 'user', images: [{ mimeType: 'text/html', data: 'QUJD' }] }] },
        { action: 'generate', provider: 'google', messages: [{ role: 'user', text: 'hi' }], model: 'gemini;drop' },
        { action: 'save_credential', scope: 'user', holderId: 'alice', provider: 'anthropic', key: 'has space' },
        { action: 'save_credential', scope: 'node', holderId: 'alice', provider: 'anthropic', key: 'sk-1234' },
      ]) expect(await t.ai(bad, 'alice')).toEqual({ status: 400, body: { error: 'invalid_command' } });
      // A picture rides to the rail as the law shapes it.
      expect((await t.ai({ action: 'generate', provider: 'anthropic', messages: [{ role: 'user', text: 'look', image: { mimeType: 'image/webp', data: 'QUJD' } }] }, 'alice')).status).toBe(200);
      expect(t.asks.at(-1)!.messages).toEqual([{ role: 'user', text: 'look', images: [{ mimeType: 'image/webp', data: 'QUJD' }] }]);
    } finally { await t.close(); }
  });
  it('the cipher binds a sealed key to its row and to the installation\'s key', () => {
    const cipher = createCredentialCipher(SECRET);
    const sealed = cipher.seal('sk-ant-abc', 'user_alice_anthropic');
    expect(cipher.open(sealed.ciphertext, 'user_alice_anthropic', sealed.keyId)).toBe('sk-ant-abc');
    expect(() => cipher.open(sealed.ciphertext, 'user_bob_anthropic', sealed.keyId)).toThrow();
    expect(() => cipher.open(sealed.ciphertext, 'user_alice_anthropic', 'other')).toThrow(/another key/);
    expect(() => createCredentialCipher('too-short')).toThrow(/32 bytes/);
    expect(createCredentialCipher(randomBytes(32).toString('hex')).keyId).toMatch(/^[0-9a-f]{16}$/);
    expect(createCredentialCipher(SECRET).keyId).toBe(cipher.keyId);
  });
});
