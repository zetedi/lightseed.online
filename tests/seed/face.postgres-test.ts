// THE FACE OF THE NODE against real PostgreSQL (ring 2026-11-03): the four public doors the origin
// serves from hosting rewrites — the being card (the built shell with its head meta swapped to a
// PUBLIC being), its small picture (a JPEG the node makes from its own media or a foreign https
// source behind an address guard), the living sitemap and the face feed — answered by the API as
// the restricted runtime role reading as a stranger, with no bearer anywhere.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { startCluster, type Cluster } from './harness';
import { createApi } from '../../seed/api/server.mjs';
import { createAuthenticator } from '../../seed/api/auth.mjs';
import { createMediaStore } from '../../seed/api/media.mjs';
import { createFace } from '../../seed/api/face.mjs';
import { authFixture } from './auth-fixture.mjs';
import { beingPath } from '../../src/domain/beingLink';
import { facePreviewDigestOf } from '../../src/domain/facePreview';

let cluster: Cluster;
beforeAll(() => { cluster = startCluster(55447); });
afterAll(() => cluster.stop());

type Json = Record<string, any>;
const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const door = (n: number) => beingPath(LID(n)).slice(3);
const SHELL = `<!DOCTYPE html><html><head><title>.seed — Example node, growing together</title>
    <meta name="description" content="A living commons." />
    <link rel="canonical" href="https://node.example/" />
    <meta property="og:site_name" content="Example node" />
    <meta property="og:title" content="Example node — growing together" />
    <meta property="og:description" content="A living commons." />
    <meta property="og:url" content="https://node.example" />
    <meta property="og:image" content="https://node.example/og.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Example node — growing together" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Example node" />
    <meta name="twitter:description" content="A living commons." />
    <meta name="twitter:image" content="https://node.example/og.png" />
</head><body><div id="root"></div></body></html>`;
const sharp = createRequire(resolve('seed/package.json'))('sharp');

const serve = async (options: { shell?: boolean; face?: boolean; remote?: { addresses: string[]; status?: number; bytes?: Buffer } } = {}) => {
  const { db } = await cluster.fresh(3);
  const fixture = authFixture();
  const directory = mkdtempSync('/tmp/lightseed-face-');
  const shellDir = join(directory, 'app'); const mediaDir = join(directory, 'media');
  if (options.shell !== false) { rmSync(shellDir, { recursive: true, force: true }); writeFileSync(shellDir + '-index.html', SHELL); }
  const media = await createMediaStore(mediaDir);
  const fetched: string[] = [];
  const picture = options.remote?.bytes ?? await sharp({ create: { width: 1600, height: 900, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 60 } } }).png().toBuffer();
  const face = options.face === false ? null : createFace({
    withSession: db.withSession, mediaGet: db.mediaGet, media, shellDir: options.shell === false ? null : directory, cacheDir: join(mediaDir, 'previews'),
    hosts: ['door.example', 'theohouse.org'], nodeDomain: 'node.example', nodeName: 'Example node', log: { error: () => undefined, warn: () => undefined },
    lookup: async () => (options.remote?.addresses ?? ['93.184.216.34']).map(address => ({ address, family: 4 })),
    fetch: async (url: string) => { fetched.push(url); const status = options.remote?.status ?? 200; return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, arrayBuffer: async () => picture.buffer.slice(picture.byteOffset, picture.byteOffset + picture.byteLength) }; },
  });
  if (options.shell !== false) writeFileSync(join(directory, 'index.html'), SHELL);
  const server = createApi(db, await createAuthenticator(fixture.config), { nodeDomain: 'node.example', faceDoors: ['door.example'], media, face });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing_address');
  const base = `http://127.0.0.1:${address.port}`;
  const get = async (path: string, headers: Record<string, string> = {}) => {
    const r = await fetch(base + path, { headers, redirect: 'manual' });
    const bytes = Buffer.from(await r.arrayBuffer()); const text = bytes.toString('utf8');
    let body: Json | null = null; try { body = JSON.parse(text) as Json; } catch { /* not json */ }
    return { status: r.status, text, bytes, body, type: r.headers.get('content-type') ?? '', cache: r.headers.get('cache-control') ?? '', location: r.headers.get('location'), cors: r.headers.get('access-control-allow-origin') };
  };
  const upload = async (path: string) => {
    const r = await fetch(base + '/v1/media/upload', { method: 'POST', headers: { 'content-type': 'image/png', 'x-lightseed-media-path': path, authorization: 'Bearer ' + fixture.token() }, body: picture });
    expect(r.status).toBe(201); return (await r.json() as Json).url as string;
  };
  const close = async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); rmSync(directory, { recursive: true, force: true }); };
  return { get, upload, close, sql: cluster.sql, fetched, mediaDir, picture, base };
};

// The garden: beings of every kind and cloak, on the node's ground and at a face.
const garden = (sql: (q: string) => string, image: string) => sql(`
  INSERT INTO users VALUES ('alice','{"displayName":"Alice"}'),('bob','{"displayName":"Bob"}');
  INSERT INTO persons VALUES ('alice','{"uid":"alice","lid":"${LID(1)}","displayName":"Alice"}'),('bob','{"uid":"bob","lid":"${LID(2)}","displayName":"Bob"}');
  INSERT INTO communities VALUES ('c1','{"lid":"${LID(31)}","name":"The O House","anchorUid":"alice","domain":"theohouse.org","domainAliases":["door.example"],"door":"invite","createdAt":"2026-01-01T00:00:00.000000Z"}');
  INSERT INTO lifetrees VALUES
    ('t1','{"lid":"${LID(11)}","anchorUid":"alice","name":"Nur <3","body":"A tree of light.\\n\\nIt   stands \\"here\\" & grows.","treeType":"LIGHTTREE","visibility":"public","domain":"theohouse.org","imageUrl":"${image}","createdAt":"2026-01-02T00:00:00.000000Z","updatedAt":"2026-10-30T00:00:00.000000Z"}'),
    ('t2','{"lid":"${LID(12)}","anchorUid":"alice","name":"Hidden","body":"secret words","treeType":"LIGHTTREE","visibility":"private","domain":"node.example","createdAt":"2026-01-03T00:00:00.000000Z"}'),
    ('t3','{"lid":"${LID(13)}","anchorUid":"alice","name":"For the node","treeType":"LIGHTTREE","visibility":"node","domain":"node.example","createdAt":"2026-01-04T00:00:00.000000Z"}'),
    ('t4','{"lid":"${LID(14)}","anchorUid":"alice","name":"Attic bed","treeType":"BED","domain":"node.example","createdAt":"2026-01-05T00:00:00.000000Z"}'),
    ('t5','{"lid":"${LID(15)}","anchorUid":"alice","name":"Elder","treeType":"LIGHTTREE","domain":"node.example","createdAt":"2026-01-06T00:00:00.000000Z"}'),
    ('t6','{"lid":"${LID(16)}","anchorUid":"alice","name":"Far tree","treeType":"LIGHTTREE","visibility":"public","domain":"node.example","imageUrl":"https://pictures.example/far.png","createdAt":"2026-02-01T00:00:00.000000Z"}'),
    ('t7','{"lid":"${LID(17)}","anchorUid":"alice","name":"Plain tree","treeType":"LIGHTTREE","visibility":"public","domain":"node.example","imageUrl":"http://pictures.example/plain.png","createdAt":"2026-02-02T00:00:00.000000Z"}');
  INSERT INTO light_houses VALUES
    ('h1','{"lid":"${LID(21)}","anchorUid":"alice","name":"The Hearth","body":"Warm.","visibility":"public","domain":"theohouse.org","latitude":50.85,"longitude":4.35,"createdAt":"2026-03-01T00:00:00.000000Z"}'),
    ('h2','{"lid":"${LID(22)}","anchorUid":"alice","name":"Quiet house","body":"Shh.","domain":"theohouse.org","latitude":50.1,"longitude":4.1,"createdAt":"2026-03-02T00:00:00.000000Z"}');
  INSERT INTO visions VALUES
    ('v1','{"lid":"${LID(41)}","authorId":"alice","title":"A green city","body":"Trees on every street.","visibility":"public","domain":"node.example","createdAt":"2026-04-01T00:00:00.000000Z"}'),
    ('v2','{"lid":"${LID(42)}","authorId":"alice","title":"Node vision","body":"Ours.","visibility":"node","domain":"node.example","createdAt":"2026-04-02T00:00:00.000000Z"}');
  INSERT INTO pulses VALUES
    ('e1','{"lid":"${LID(51)}","authorId":"alice","type":"event","title":"Open day","body":"Come.","visibility":"public","domain":"theohouse.org","eventDate":"2026-12-01T10:00:00.000Z","eventEndDate":"2026-12-01T12:00:00.000Z","imageUrls":["https://pictures.example/open.jpg","https://pictures.example/open2.jpg"],"createdAt":"2026-05-01T00:00:00.000000Z"}'),
    ('e2','{"lid":"${LID(52)}","authorId":"alice","type":"event","title":"Node gathering","visibility":"node","domain":"theohouse.org","eventDate":"2026-11-20T10:00:00.000Z","createdAt":"2026-05-02T00:00:00.000000Z"}'),
    ('e3','{"lid":"${LID(53)}","authorId":"alice","type":"event","title":"Members only","visibility":"community","communityId":"c1","domain":"theohouse.org","eventDate":"2026-11-10T10:00:00.000Z","createdAt":"2026-05-03T00:00:00.000000Z"}'),
    ('e4','{"lid":"${LID(54)}","authorId":"alice","type":"reach","title":"Private words","content":"between us","visibility":"public","participantUids":["alice","bob"],"domain":"theohouse.org","createdAt":"2026-05-04T00:00:00.000000Z"}'),
    ('e5','{"lid":"${LID(55)}","authorId":"alice","type":"event","title":"Elsewhere","visibility":"public","domain":"other.example","eventDate":"2026-11-15T10:00:00.000Z","createdAt":"2026-05-05T00:00:00.000000Z"}'),
    ('e6','{"lid":"${LID(56)}","authorId":"alice","type":"event","title":"Undated legacy","domain":"theohouse.org","createdAt":"2026-05-06T00:00:00.000000Z"}');`);

describe('the being card', () => {
  it('dresses the shell for a public being alone, at a host the node serves, and never leaks a name', async () => {
    const t = await serve();
    try {
      const image = await t.upload('users/alice/tree/nur.png');
      garden(t.sql, image);
      const nur = await t.get(`/b/${door(11)}`);
      expect(nur.status).toBe(200); expect(nur.type).toBe('text/html; charset=utf-8'); expect(nur.cache).toBe('public, max-age=300, s-maxage=600');
      expect(nur.text).toContain('<title>Nur &lt;3 — The O House</title>');
      expect(nur.text).toContain('<meta property="og:site_name" content="The O House" />');
      expect(nur.text).toContain('<meta name="description" content="A tree of light. It stands &quot;here&quot; &amp; grows." />');
      expect(nur.text).toContain(`<meta property="og:url" content="https://node.example/b/${door(11)}" />`);
      expect(nur.text).toContain(`<link rel="canonical" href="https://node.example/b/${door(11)}" />`);
      expect(nur.text).toContain(`<meta property="og:image" content="https://node.example/face/${door(11)}.jpg?v=${facePreviewDigestOf(image)}" />`);
      expect(nur.text).toContain('<meta name="twitter:card" content="summary" />');
      expect(nur.text).not.toContain('og:image:width');
      // The same being by its canonical door, at a face door the node serves, keeps that host.
      const atDoor = await t.get(`/b/${LID(11)}`, { 'x-forwarded-host': 'door.example' });
      expect(atDoor.text).toContain(`<meta property="og:url" content="https://door.example/b/${LID(11)}" />`);
      // A forged host collapses to the node's own; a port rides along on a host the node serves.
      expect((await t.get(`/b/${door(11)}`, { 'x-forwarded-host': 'evil.example' })).text).toContain('content="https://node.example/b/');
      expect((await t.get(`/b/${door(11)}`, { 'x-forwarded-host': 'node.example:8443', host: 'api' })).text).toContain('content="https://node.example:8443/b/');
      // Not public, unknown, a bed without a cloak, an addressed reach: the unmodified shell, every time.
      for (const n of [12, 13, 14, 22, 42, 54, 999]) {
        const r = await t.get(`/b/${door(n)}`);
        expect(r.status, String(n)).toBe(200); expect(r.text, String(n)).toBe(SHELL);
      }
      expect((await t.get(`/b/${door(12)}`)).text).not.toContain('Hidden');
      // The legacy-absent tree is public; the node's own ground names the node.
      const elder = await t.get(`/b/${door(15)}`);
      expect(elder.text).toContain('<title>Elder — Example node</title>');
      expect(elder.text).toContain('<meta name="description" content="Elder — a living being on Example node." />');
      expect(elder.text).toContain('<meta property="og:image" content="https://node.example/og.png" />');
      expect(elder.text).toContain('og:image:width');
      // A public Light House carries a Place with its coordinates; a vision and a public event have cards too.
      const hearth = await t.get(`/b/${door(21)}`);
      expect(hearth.text).toContain('<title>The Hearth — The O House</title>');
      expect(hearth.text).toContain('<script type="application/ld+json">{"@context":"https://schema.org","@type":"Place","name":"The Hearth","description":"Warm.","url":"https://node.example/b/' + door(21) + '","geo":{"@type":"GeoCoordinates","latitude":50.85,"longitude":4.35}}</script>');
      expect((await t.get(`/b/${door(41)}`)).text).toContain('<title>A green city — Example node</title>');
      const open = await t.get(`/b/${door(51)}`);
      expect(open.text).toContain('<title>Open day — The O House</title>');
      expect(open.text).toContain(`/face/${door(51)}.jpg?v=${facePreviewDigestOf('https://pictures.example/open.jpg')}`);
      // A plain-http picture is no face: the og.png stands in on the card.
      expect((await t.get(`/b/${door(17)}`)).text).toContain('<meta property="og:image" content="https://node.example/og.png" />');
      // HEAD answers the same head without a body; a write is refused; a malformed door is not found.
      const head = await fetch(`${t.base}/b/${door(11)}`, { method: 'HEAD' });
      expect(head.status).toBe(200); expect(head.headers.get('content-type')).toBe('text/html; charset=utf-8'); expect((await head.text()).length).toBe(0);
      expect((await fetch(`${t.base}/b/${door(11)}`, { method: 'POST' })).status).toBe(405);
      expect((await t.get('/b/short')).status).toBe(404);
    } finally { await t.close(); }
  });
  it('answers by name without a shell or without a face, so the edge can stand in', async () => {
    const bare = await serve({ shell: false });
    try {
      garden(bare.sql, '');
      const r = await bare.get(`/b/${door(11)}`);
      expect(r.status).toBe(503); expect(r.body).toEqual({ error: 'shell_unavailable' });
      // The sitemap and the feed need no shell.
      expect((await bare.get('/sitemap.xml')).status).toBe(200);
      expect((await bare.get('/faceEvents?domain=theohouse.org')).status).toBe(200);
    } finally { await bare.close(); }
    const faceless = await serve({ face: false });
    try {
      for (const path of [`/b/${door(11)}`, `/face/${door(11)}.jpg`, '/sitemap.xml', '/faceEvents?domain=theohouse.org']) {
        const r = await faceless.get(path); expect(r.status, path).toBe(503); expect(r.body, path).toEqual({ error: 'face_unavailable' });
      }
    } finally { await faceless.close(); }
  });
});

describe('the face picture', () => {
  it("makes a small JPEG once from the node's own media, keeps it, and hands og.png for every other door", async () => {
    const t = await serve();
    try {
      const image = await t.upload('users/alice/tree/nur.png');
      garden(t.sql, image);
      const first = await t.get(`/face/${door(11)}.jpg?v=abc`);
      expect(first.status).toBe(200); expect(first.type).toBe('image/jpeg');
      expect(first.cache).toBe('public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
      expect(first.bytes.length).toBeLessThanOrEqual(250_000);
      expect(first.bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      const meta = await sharp(first.bytes).metadata();
      expect(meta.format).toBe('jpeg'); expect(meta.width).toBeLessThanOrEqual(1200); expect(meta.height).toBeLessThanOrEqual(1200); expect(meta.width).toBeGreaterThan(meta.height!);
      // Kept beside the media under the being's true name and the source's digest; the second answer is the kept one.
      const kept = readdirSync(join(t.mediaDir, 'previews', LID(11)));
      expect(kept).toEqual([`${facePreviewDigestOf(image)}.jpg`]);
      const again = await t.get(`/face/${door(11)}`);
      expect(again.status).toBe(200); expect(Buffer.compare(again.bytes, first.bytes)).toBe(0);
      expect(t.fetched).toEqual([]);
      // Not public, no picture, a plain-http picture, unknown: og.png, by redirect.
      for (const n of [12, 13, 15, 17, 999]) {
        const r = await t.get(`/face/${door(n)}.jpg`);
        expect(r.status, String(n)).toBe(302); expect(r.location, String(n)).toBe('https://node.example/og.png');
      }
      expect((await t.get(`/face/${door(12)}.jpg`, { 'x-forwarded-host': 'door.example' })).location).toBe('https://door.example/og.png');
      expect((await t.get(`/face/${door(12)}.jpg`, { 'x-forwarded-host': 'evil.example' })).location).toBe('https://node.example/og.png');
    } finally { await t.close(); }
  });
  it('fetches a foreign https picture only at a public address, never following a redirect', async () => {
    const far = await serve();
    try {
      garden(far.sql, '');
      const r = await far.get(`/face/${door(16)}.jpg`);
      expect(r.status).toBe(200); expect(r.type).toBe('image/jpeg'); expect(r.bytes.length).toBeLessThanOrEqual(250_000);
      expect(far.fetched).toEqual(['https://pictures.example/far.png']);
      await far.get(`/face/${door(16)}.jpg`);
      expect(far.fetched.length).toBe(1); // kept
      // The event's picture is foreign too.
      expect((await far.get(`/face/${door(51)}.jpg`)).status).toBe(200);
    } finally { await far.close(); }
    const inward = await serve({ remote: { addresses: ['93.184.216.34', '10.0.0.7'] } });
    try {
      garden(inward.sql, '');
      const r = await inward.get(`/face/${door(16)}.jpg`);
      expect(r.status).toBe(302); expect(inward.fetched).toEqual([]);
    } finally { await inward.close(); }
    const loopback = await serve({ remote: { addresses: ['::1'] } });
    try {
      garden(loopback.sql, '');
      expect((await loopback.get(`/face/${door(16)}.jpg`)).status).toBe(302); expect(loopback.fetched).toEqual([]);
    } finally { await loopback.close(); }
    const bounced = await serve({ remote: { addresses: ['93.184.216.34'], status: 302 } });
    try {
      garden(bounced.sql, '');
      expect((await bounced.get(`/face/${door(16)}.jpg`)).status).toBe(302); expect(bounced.fetched.length).toBe(1);
      expect(existsSync(join(bounced.mediaDir, 'previews'))).toBe(false); // nothing kept
    } finally { await bounced.close(); }
    const broken = await serve({ remote: { addresses: ['93.184.216.34'], bytes: Buffer.from('not a picture at all') } });
    try {
      garden(broken.sql, '');
      expect((await broken.get(`/face/${door(16)}.jpg`)).status).toBe(302);
    } finally { await broken.close(); }
  });
});

describe('the living sitemap', () => {
  it('lists home and every explicitly public tree, house and vision, newest first', async () => {
    const t = await serve();
    try {
      garden(t.sql, '');
      const r = await t.get('/sitemap.xml', { 'x-forwarded-host': 'door.example' });
      expect(r.status).toBe(200); expect(r.type).toBe('application/xml; charset=utf-8'); expect(r.cache).toBe('public, max-age=3600, s-maxage=21600');
      const locs = [...r.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
      expect(locs).toEqual([
        'https://door.example/',
        `https://door.example/b/${LID(11)}`, // updated 2026-10-30
        `https://door.example/b/${LID(41)}`, // 2026-04-01
        `https://door.example/b/${LID(21)}`, // 2026-03-01
        `https://door.example/b/${LID(17)}`, // 2026-02-02
        `https://door.example/b/${LID(16)}`, // 2026-02-01
      ]);
      expect(r.text).toContain(`<loc>https://door.example/b/${LID(11)}</loc>\n    <lastmod>2026-10-30</lastmod>`);
      for (const n of [12, 13, 14, 15, 22, 42, 51]) expect(r.text, String(n)).not.toContain(LID(n));
      expect((await t.get('/sitemap.xml', { 'x-forwarded-host': 'evil.example' })).text).toContain('<loc>https://node.example/</loc>');
    } finally { await t.close(); }
  });
});

describe('the face feed', () => {
  it("speaks a face's public and node gatherings to its mother site, by name or at a door, and nothing narrower", async () => {
    const t = await serve();
    try {
      garden(t.sql, '');
      const r = await t.get('/faceEvents?domain=theohouse.org');
      expect(r.status).toBe(200); expect(r.cors).toBe('*'); expect(r.cache).toBe('public, max-age=300, s-maxage=600');
      expect(r.body).toEqual({ domain: 'theohouse.org', events: [
        { lid: LID(52), title: 'Node gathering', body: '', eventDate: '2026-11-20T10:00:00.000Z', eventEndDate: '', visibility: 'node', imageUrl: '' },
        { lid: LID(51), title: 'Open day', body: 'Come.', eventDate: '2026-12-01T10:00:00.000Z', eventEndDate: '2026-12-01T12:00:00.000Z', visibility: 'public', imageUrl: 'https://pictures.example/open.jpg' },
        { lid: LID(56), title: 'Undated legacy', body: '', eventDate: '', eventEndDate: '', visibility: 'public', imageUrl: '' },
      ] });
      expect(JSON.stringify(r.body)).not.toContain('alice');
      // At a door the face answers at, the feed is the same face's, named by its home domain.
      expect((await t.get('/faceEvents?domain=door.example')).body?.domain).toBe('theohouse.org');
      expect((await t.get('/faceEvents?domain=WWW.Door.Example')).body?.events).toHaveLength(3);
      // The host stands in for a missing parameter; an unknown domain has no cradle; no domain at all is refused.
      expect((await t.get('/faceEvents', { 'x-forwarded-host': 'theohouse.org' })).body?.events).toHaveLength(3);
      expect((await t.get('/faceEvents', { 'x-forwarded-host': 'node.example' })).status).toBe(404);
      const none = await t.get('/faceEvents?domain=nowhere.example');
      expect(none.status).toBe(404); expect(none.body).toEqual({ error: 'no cradle at this domain', events: [] });
      // A parameter that is no domain falls back to the host, and a host the node does not serve to the node's own ground.
      expect((await t.get('/faceEvents?domain=not%20a%20domain', { 'x-forwarded-host': 'api' })).status).toBe(404);
      // A stranger reading pulses through the ordinary door still sees no node gathering: the feed's reach is the feed's alone.
      expect(t.sql(`SELECT set_config('seed.uid','',false); SELECT count(*) FROM pulses WHERE seed.can_read_pulse(doc) AND doc->>'visibility'='node';`)).toBe('0');
    } finally { await t.close(); }
  });
});
