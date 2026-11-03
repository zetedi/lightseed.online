// THE RELEASE OF A PICTURE against real PostgreSQL (ring 2026-11-03): the origin's releasePicture on
// the independent node — only the appearance seats, only by a hand that holds the seat, only once the
// holder's document no longer shows the picture; the files content-addressed and shared, so a release
// marks orphans and the sweep frees a file only when no manifest names it any more, under the hash's
// lock, which a publish also takes. The API runs as the restricted runtime role; every ask carries a
// real bearer from the disposable issuer.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { startCluster, type Cluster } from './harness';
import { createApi } from '../../seed/api/server.mjs';
import { createAuthenticator } from '../../seed/api/auth.mjs';
import { createMediaStore } from '../../seed/api/media.mjs';
import { createClock } from '../../seed/api/clock.mjs';
import { sweepOrphans } from '../../seed/api/pictures.mjs';
import { authFixture } from './auth-fixture.mjs';

let cluster: Cluster;
beforeAll(() => { cluster = startCluster(55448); });
afterAll(() => cluster.stop());

type Json = Record<string, any>;
const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const sharp = createRequire(resolve('seed/package.json'))('sharp');
const picture = (seed: number): Promise<Buffer> => sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: (seed * 37) % 256, g: (seed * 91) % 256, b: 90 } } }).png().toBuffer();

const serve = async () => {
  const { db } = await cluster.fresh(3);
  const fixture = authFixture();
  fixture.config.bindings.push({ subject: 'issuer-staff', uid: 'staff' });
  const directory = mkdtempSync('/tmp/lightseed-pictures-');
  const media = await createMediaStore(directory);
  const server = createApi(db, await createAuthenticator(fixture.config), { nodeDomain: 'node.example', media });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing_address');
  const base = `http://127.0.0.1:${address.port}`;
  const tokens: Record<string, string> = { alice: fixture.token(), bob: fixture.token({ sub: 'issuer-bob' }), staff: fixture.token({ sub: 'issuer-staff' }) };
  const upload = async (who: string, path: string, bytes: Buffer) => {
    const r = await fetch(base + '/v1/media/upload', { method: 'POST', headers: { 'content-type': 'image/png', 'x-lightseed-media-path': path, authorization: 'Bearer ' + tokens[who] }, body: bytes });
    return { status: r.status, body: await r.json() as Json };
  };
  const release = async (who: string | null, url: unknown, method = 'POST') => {
    const r = await fetch(base + '/v1/media/release', { method, headers: { 'content-type': 'application/json', ...(who ? { authorization: 'Bearer ' + tokens[who] } : {}) }, body: method === 'POST' ? JSON.stringify({ url }) : undefined });
    return { status: r.status, body: await r.json() as Json };
  };
  const read = async (path: string) => (await fetch(base + '/v1/media?path=' + encodeURIComponent(path))).status;
  const files = () => readdirSync(directory).filter(n => /^[a-f0-9]{64}$/.test(n)).sort();
  const manifest = (path: string): Json | null => { const row = cluster.sql(`SELECT doc FROM seed.media_objects WHERE path='${path}'`); return row ? JSON.parse(row) as Json : null; };
  const orphans = () => cluster.sql(`SELECT coalesce(string_agg(hash, ',' ORDER BY hash), '') FROM seed.media_orphans`);
  const close = async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); rmSync(directory, { recursive: true, force: true }); };
  return { db, media, upload, release, read, files, manifest, orphans, close, sql: cluster.sql };
};

const people = (sql: (q: string) => string) => sql(`
  INSERT INTO users VALUES ('alice','{"displayName":"Alice"}'),('bob','{"displayName":"Bob"}'),('staff','{"displayName":"Staff"}');
  INSERT INTO persons VALUES ('alice','{"uid":"alice","lid":"${LID(1)}","displayName":"Alice"}'),('bob','{"uid":"bob","lid":"${LID(2)}","displayName":"Bob"}'),('staff','{"uid":"staff","lid":"${LID(3)}","displayName":"Staff"}');
  INSERT INTO admins VALUES ('staff','{}');
  INSERT INTO communities VALUES ('c1','{"lid":"${LID(31)}","name":"Circle","anchorUid":"alice","domain":"node.example","createdAt":"2026-01-01T00:00:00.000000Z"}');`);

describe('the release of a picture', () => {
  it("releases a community's seat its holder no longer shows — by the anchor, a keeper or staff, never a stranger", async () => {
    const t = await serve();
    try {
      people(t.sql);
      const bytes = await picture(1);
      const up = await t.upload('alice', 'communities/c1/logo_1.png', bytes);
      expect(up.status).toBe(201);
      const url = up.body.url as string;
      expect(url).toBe('/v1/media?path=communities%2Fc1%2Flogo_1.png');
      expect(t.files()).toHaveLength(3);
      // Shown by the holder in the form the upload answered: in use.
      t.sql(`UPDATE communities SET doc=doc||'{"logoUrl":"${url}"}' WHERE id='c1'`);
      expect(await t.release('alice', url)).toMatchObject({ status: 409, body: { error: 'picture_in_use' } });
      // Shown in the raw form the soil writes: in use.
      t.sql(`UPDATE communities SET doc=doc||'{"logoUrl":"/v1/media?path=communities/c1/logo_1.png"}' WHERE id='c1'`);
      expect(await t.release('alice', url)).toMatchObject({ status: 409, body: { error: 'picture_in_use' } });
      // Shown deeper in the document: in use.
      t.sql(`UPDATE communities SET doc=doc||'{"logoUrl":"","papers":{"vision":{"hero":"${url}"}}}' WHERE id='c1'`);
      expect(await t.release('alice', url)).toMatchObject({ status: 409, body: { error: 'picture_in_use' } });
      t.sql(`UPDATE communities SET doc=doc-'papers' WHERE id='c1'`);
      // A stranger may not, even now that nothing shows it.
      expect(await t.release('bob', url)).toMatchObject({ status: 403, body: { error: 'picture_not_yours' } });
      expect(t.manifest('communities/c1/logo_1.png')).not.toBeNull();
      expect(t.files()).toHaveLength(3);
      // The anchor may: the manifest is gone, the files are gone, no orphan stands, the door answers 404.
      expect(await t.release('alice', url)).toEqual({ status: 200, body: { released: 3, kept: 0 } });
      expect(t.manifest('communities/c1/logo_1.png')).toBeNull();
      expect(t.files()).toEqual([]);
      expect(t.orphans()).toBe('');
      expect(await t.read('communities/c1/logo_1.png')).toBe(404);
      expect(await t.release('alice', url)).toMatchObject({ status: 404, body: { error: 'picture_missing' } });
      // A keeper's hand, and staff's, on the hero and a gallery picture.
      t.sql(`INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','keeper','c1','${LID(41)}')`);
      const hero = (await t.upload('alice', 'communities/c1/hero_1.png', await picture(2))).body.url as string;
      const gallery = (await t.upload('alice', 'communities/c1/1700000000000.png', await picture(3))).body.url as string;
      expect(t.files()).toHaveLength(6);
      expect(await t.release('bob', hero)).toEqual({ status: 200, body: { released: 3, kept: 0 } });
      expect(await t.release('staff', gallery)).toEqual({ status: 200, body: { released: 3, kept: 0 } });
      expect(t.files()).toEqual([]);
    } finally { await t.close(); }
  });

  it('keeps a file another manifest still names, and frees it with the last', async () => {
    const t = await serve();
    try {
      people(t.sql);
      const bytes = await picture(4);
      const one = (await t.upload('alice', 'communities/c1/hero_1.png', bytes)).body.url as string;
      const two = (await t.upload('alice', 'communities/c1/hero_2.png', bytes)).body.url as string;
      expect(t.files()).toHaveLength(3);
      const first = t.manifest('communities/c1/hero_1.png'), second = t.manifest('communities/c1/hero_2.png');
      expect(first?.primary.hash).toBe(second?.primary.hash);
      expect(await t.release('alice', one)).toEqual({ status: 200, body: { released: 0, kept: 3 } });
      expect(t.manifest('communities/c1/hero_1.png')).toBeNull();
      expect(t.files()).toHaveLength(3);
      expect(t.orphans()).toBe('');
      expect(await t.read('communities/c1/hero_2.png')).toBe(200);
      expect(await t.release('alice', two)).toEqual({ status: 200, body: { released: 3, kept: 0 } });
      expect(t.files()).toEqual([]);
    } finally { await t.close(); }
  });

  it('never releases what a chain binds, a door of another node, a malformed ask or a seat without a manifest', async () => {
    const t = await serve();
    try {
      people(t.sql);
      const bound = (await t.upload('alice', 'users/alice/pulses/ai/1.png', await picture(5))).body.url as string;
      expect(await t.release('alice', bound)).toMatchObject({ status: 409, body: { error: 'picture_not_releasable' } });
      expect(await t.release('staff', bound)).toMatchObject({ status: 409, body: { error: 'picture_not_releasable' } });
      expect(t.files()).toHaveLength(3);
      expect(await t.release('alice', 'https://firebasestorage.googleapis.com/v0/b/x.app/o/communities%2Fc1%2Flogo_1.png?alt=media')).toMatchObject({ status: 400, body: { error: 'invalid_command' } });
      expect(await t.release('alice', '/v1/media?path=communities%2Fc1%2Flogo_9.png&variant=small')).toMatchObject({ status: 400, body: { error: 'invalid_command' } });
      expect(await t.release('alice', 42)).toMatchObject({ status: 400, body: { error: 'invalid_command' } });
      expect(await t.release('alice', '/v1/media?path=communities%2Fc1%2Flogo_9.png')).toMatchObject({ status: 404, body: { error: 'picture_missing' } });
      expect(await t.release('bob', '/v1/media?path=communities%2Fc1%2Flogo_9.png')).toMatchObject({ status: 403, body: { error: 'picture_not_yours' } });
      expect(await t.release(null, bound)).toMatchObject({ status: 401 });
      expect(await t.release('alice', bound, 'GET')).toMatchObject({ status: 405 });
      // The orphans and the manifests are the soil's alone.
      await expect(t.db.withSession('alice', (c: any) => c.query('SELECT * FROM seed.media_orphans'))).rejects.toMatchObject({ code: '42501' });
      await expect(t.db.withSession('staff', (c: any) => c.query('SELECT seed.picture_holder($1,$2,$3)', ['communities/c1/logo_1.png', 'community', 'c1']))).rejects.toMatchObject({ code: '42501' });
    } finally { await t.close(); }
  });

  it("releases a person's site seat by the person or staff alone, the raw door the soil writes counting as shown", async () => {
    const t = await serve();
    try {
      people(t.sql);
      const logo = (await t.upload('alice', 'users/alice/site-theme/logo_1.png', await picture(6))).body.url as string;
      t.sql(`UPDATE users SET doc=doc||'{"siteLogoUrl":"/v1/media?path=users/alice/site-theme/logo_1.png"}' WHERE id='alice'`);
      expect(await t.release('alice', logo)).toMatchObject({ status: 409, body: { error: 'picture_in_use' } });
      expect(await t.release('bob', logo)).toMatchObject({ status: 403, body: { error: 'picture_not_yours' } });
      t.sql(`UPDATE users SET doc=doc||'{"siteLogoUrl":""}' WHERE id='alice'`);
      expect(await t.release('bob', logo)).toMatchObject({ status: 403, body: { error: 'picture_not_yours' } });
      expect(await t.release('staff', logo)).toEqual({ status: 200, body: { released: 3, kept: 0 } });
      expect(t.files()).toEqual([]);
      const hero = (await t.upload('alice', 'users/alice/site-theme/hero_1.png', await picture(7))).body.url as string;
      expect(await t.release('alice', hero)).toEqual({ status: 200, body: { released: 3, kept: 0 } });
    } finally { await t.close(); }
  });

  it('the sweep lifts a mark for bytes a manifest names, settles one for a file already gone, and runs on the clock', async () => {
    const t = await serve();
    try {
      people(t.sql);
      const warnings: string[] = [];
      const log = { warn: (...a: unknown[]) => { warnings.push(a.map(String).join(' ')); } };
      const url = (await t.upload('alice', 'communities/c1/pages/1.png', await picture(8))).body.url as string;
      const named = t.manifest('communities/c1/pages/1.png')!;
      // A mark a crash left behind for bytes a manifest still names: lifted, the file untouched.
      t.sql(`INSERT INTO seed.media_orphans(hash) VALUES ('${named.primary.hash}')`);
      expect(await sweepOrphans({ withSession: t.db.withSession, media: t.media, log })).toEqual({ orphans: 1, freed: 0, kept: 1, failed: 0 });
      expect(t.orphans()).toBe('');
      expect(t.files()).toHaveLength(3);
      // A mark whose file is gone already: settled without complaint.
      t.sql(`INSERT INTO seed.media_orphans(hash) VALUES ('${'f'.repeat(64)}')`);
      expect(await sweepOrphans({ withSession: t.db.withSession, media: t.media, log })).toEqual({ orphans: 1, freed: 1, kept: 0, failed: 0 });
      expect(t.orphans()).toBe('');
      // The clock's nightly sweep: the same hand, reported.
      t.sql(`INSERT INTO seed.media_orphans(hash) VALUES ('${'e'.repeat(64)}')`);
      const clock = createClock({ withSession: t.db.withSession, timeZone: 'Europe/Brussels', media: t.media, log });
      const ran = await clock.tick();
      expect(ran?.find(r => r.job === 'sweep')).toMatchObject({ outcome: 'done', report: { orphans: 1, freed: 1, kept: 0, failed: 0 } });
      expect(t.orphans()).toBe('');
      // The release's own sweep leaves nothing for the night.
      expect(await t.release('alice', url)).toEqual({ status: 200, body: { released: 3, kept: 0 } });
      expect(t.files()).toEqual([]);
      expect(warnings).toEqual([]);
    } finally { await t.close(); }
  });

  it('a publish under the lock finds its files, or asks for the bytes again', async () => {
    const t = await serve();
    try {
      people(t.sql);
      const bytes = await picture(9);
      const manifest = await t.media.encode(bytes, 'image/png');
      // A sweep that took the same bytes before the publish held the lock: the publish refuses, nothing lands.
      for (const key of ['primary', 'small', 'large'] as const) await t.media.remove(manifest[key].hash);
      await expect(t.db.mediaPublish('alice', 'communities/c1/pages/2.png', manifest, t.media.present)).rejects.toMatchObject({ code: 'MEDIA_SWEPT' });
      expect(t.manifest('communities/c1/pages/2.png')).toBeNull();
      // Through the API the bytes are encoded once more and land with their files.
      expect((await t.upload('alice', 'communities/c1/pages/2.png', bytes)).status).toBe(201);
      expect(t.files()).toHaveLength(3);
      expect(await t.media.present(t.manifest('communities/c1/pages/2.png')!)).toBe(true);
      // The lock is the soil's: a malformed ask is refused, and a stranger's publish still needs standing.
      await expect(t.db.withSession('alice', (c: any) => c.query('SELECT seed.media_lock($1::text[])', [['nope']]))).rejects.toMatchObject({ code: '22023' });
      await expect(t.db.mediaPublish('bob', 'communities/c1/pages/3.png', manifest, t.media.present)).rejects.toMatchObject({ code: '42501' });
    } finally { await t.close(); }
  });
});
