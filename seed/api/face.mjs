// THE FACE OF THE NODE (ring 2026-11-03): the node speaking to whoever stands at it without signing
// in — the origin's four hosting-rewrite functions (functions/src/preview.ts) on this soil. /b/<door>
// hands EVERYONE the same built shell with its head meta swapped to a PUBLIC being's own name, words
// and picture (bots read the meta, a human's shell boots and opens the door); anything not public, or
// unknown, is the unmodified shell — the generic card, never a leaked name. /face/<door>.jpg is the
// small, honest JPEG behind the card (made once with sharp, kept beside the media), /sitemap.xml the
// living sitemap of public beings, /faceEvents a face's happenings for its mother site. The law is
// domain/facePage (the gate, the host, the swap, the sitemap), domain/facePreview (the ladder, the
// key) and domain/faceEvents (the feed); this module owns the plumbing. The being is read as a
// stranger reads — the runtime role under the row policies with no session — and the card gate is
// applied on top. No request here ever fetches the shell over the network (the origin's mirror-guard
// lesson): the built application is mounted read-only beside the API (SEED_SHELL_DIR).
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import sharp from 'sharp';
import { seedMediaPath } from '../../src/domain/seedMedia.mjs';
import { lidOfDoor, publicCardOf, canonicalHostOf, faceSourceOf, isPublicAddress, shareCardOf, shellCardOf, sitemapXmlOf, SITEMAP_MAX_BEINGS,
  facePreviewAttempts, facePreviewKeyOf, FACE_PREVIEW_MAX_BYTES, faceFeedOf, feedDomainOf, momentMsOf } from '../generated/chain.mjs';

const FACE_SOURCE_MAX_BYTES = 40 * 1024 * 1024;
const FACE_FETCH_TIMEOUT_MS = 20_000;
const FACE_GROUND = '#04070f'; // the night the app stands on — under any transparency
const FACE_RENDERS_AT_ONCE = 2;

/** @param {{withSession: (uid: string|null, work: (client: *) => Promise<*>) => Promise<*>, mediaGet: (path: string) => Promise<*>, media?: *|null,
 *   shellDir?: string|null, cacheDir?: string|null, hosts: string[], nodeDomain: string, nodeName: string, log?: *, fetch?: *, lookup?: (host: string) => Promise<{address: string}[]>}} p */
export function createFace({ withSession, mediaGet, media = null, shellDir = null, cacheDir = null, hosts, nodeDomain, nodeName, log = console,
  fetch = globalThis.fetch, lookup = host => dnsLookup(host, { all: true }) }) {
  const ownHosts = [...new Set([nodeDomain, ...hosts].map(h => h.toLowerCase()))];
  const hostOf = req => canonicalHostOf(req.headers['x-forwarded-host'] ?? req.headers.host, ownHosts, nodeDomain);
  const fault = (what, error) => log.error(`face ${what} failed:`, error?.code ?? '', error instanceof Error ? error.message : String(error));

  // The shell: read once, re-read when the file changes (a new build is a new shell).
  let shell = { key: '', html: '' };
  async function shellHtml() {
    if (!shellDir) return '';
    const path = join(shellDir, 'index.html');
    try {
      const s = await stat(path);
      const key = `${s.mtimeMs}:${s.size}`;
      if (key !== shell.key) shell = { key, html: (await readFile(path)).toString('utf8') };
      return shell.html;
    } catch { return ''; }
  }

  // The being a door names, as a stranger may read it, and the origin's card gate on top.
  async function publicBeing(door) {
    const lid = lidOfDoor(door);
    if (!lid) return null;
    const rows = await withSession(null, async c => (await c.query(`
      SELECT * FROM (
        SELECT 1 AS rank, 'tree' AS kind, doc FROM public.lifetrees WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
        UNION ALL SELECT 2, 'house', doc FROM public.light_houses WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
        UNION ALL SELECT 3, 'vision', doc FROM public.visions WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
        UNION ALL SELECT 4, 'pulse', doc FROM public.pulses WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36) found
      ORDER BY rank LIMIT 1`, [lid])).rows);
    if (!rows.length) return null;
    const card = publicCardOf(rows[0].kind, rows[0].doc);
    return card ? { lid, card } : null;
  }
  // The place a being's ground names (the mail organ's lookup: the community at the domain, else at the door).
  const placeOf = domain => withSession(null, async c => (await c.query('SELECT seed.mail_place($1) AS place', [domain])).rows[0].place);

  async function card(req, res, door) {
    const host = hostOf(req);
    const html = await shellHtml();
    if (!html) { res.writeHead(503); res.end(JSON.stringify({ error: 'shell_unavailable' })); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    try {
      const found = await publicBeing(door);
      if (!found || !found.card.name) { res.writeHead(200); res.end(html); return; } // the generic card
      const place = found.card.domain ? await placeOf(found.card.domain) : null;
      const { card: share, placeLd } = shareCardOf({ host, door, being: found.card, place, nodeName, ownHosts });
      res.writeHead(200); res.end(shellCardOf(html, share, placeLd));
    } catch (error) { fault('card', error); res.writeHead(200); res.end(html); } // never a broken page
  }

  // --- the picture ---------------------------------------------------------------------------------
  async function readKept(file) {
    let handle;
    try { handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW); } catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
    try { return await handle.readFile(); } finally { await handle.close(); }
  }
  async function keep(file, bytes) {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    const temporary = `${file}.${randomBytes(8).toString('hex')}.tmp`;
    try { await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' }); await rename(temporary, file); }
    finally { await unlink(temporary).catch(() => undefined); }
  }
  // The node's own media: the primary, by its manifest.
  async function localSource(path) {
    if (!media || !seedMediaPath(path)) return null;
    const manifest = await mediaGet(path);
    return manifest?.primary ? media.read(manifest.primary) : null;
  }
  // A foreign picture, bounded: https alone, a public address alone (looked up first), no redirect
  // followed (a redirect could bounce inward), a runaway source never holds the node.
  async function remoteSource(url) {
    let addresses;
    try { addresses = await lookup(new URL(url).hostname); } catch { return null; }
    if (!Array.isArray(addresses) || !addresses.length || !addresses.every(a => isPublicAddress(String(a?.address ?? a)))) return null;
    const r = await fetch(url, { signal: AbortSignal.timeout(FACE_FETCH_TIMEOUT_MS), redirect: 'manual', headers: { 'user-agent': 'lightseed-face-fetch' } });
    if (!r.ok) return null;
    if (Number(r.headers.get('content-length') || 0) > FACE_SOURCE_MAX_BYTES) return null;
    const bytes = Buffer.from(await r.arrayBuffer());
    return bytes.length > FACE_SOURCE_MAX_BYTES ? null : bytes;
  }
  // Decode and fit ONCE (upright by EXIF, flattened onto the night, never enlarged), then walk the
  // ladder from that small raster. The first attempt under the budget wins; failing all, the smallest.
  let rendering = 0;
  async function renderFacePreview(source) {
    const [first] = facePreviewAttempts();
    const base = await sharp(source, { failOn: 'none', limitInputPixels: 80_000_000, animated: false })
      .rotate().flatten({ background: FACE_GROUND })
      .resize({ width: first.edge, height: first.edge, fit: 'inside', withoutEnlargement: true })
      .raw().toBuffer({ resolveWithObject: true });
    let best = null;
    for (const { edge, quality } of facePreviewAttempts()) {
      const out = await sharp(base.data, { raw: { width: base.info.width, height: base.info.height, channels: base.info.channels } })
        .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true }).toBuffer();
      if (!best || out.length < best.length) best = out;
      if (out.length <= FACE_PREVIEW_MAX_BYTES) return out;
    }
    return best;
  }
  async function picture(req, res, door) {
    const host = hostOf(req);
    // No face to show: the node's own og.png stands in, as it does on the card itself.
    const fallback = () => { res.setHeader('Cache-Control', 'public, max-age=300'); res.writeHead(302, { Location: `https://${host}/og.png` }); res.end(); };
    try {
      const found = await publicBeing(door);
      const source = found ? faceSourceOf(found.card.image, ownHosts) : null;
      if (!found || !source || !cacheDir) { fallback(); return; }
      const file = join(cacheDir, facePreviewKeyOf(found.lid, found.card.image).slice('previews/'.length));
      let bytes = await readKept(file);
      if (!bytes) {
        if (rendering >= FACE_RENDERS_AT_ONCE) { fallback(); return; }
        rendering++;
        try {
          const original = source.kind === 'local' ? await localSource(source.path) : await remoteSource(source.url);
          if (!original) { fallback(); return; }
          bytes = await renderFacePreview(original);
          await keep(file, bytes);
        } finally { rendering--; }
      }
      res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Content-Length', bytes.length);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.writeHead(200); res.end(bytes);
    } catch (error) { fault('picture', error); fallback(); }
  }

  // --- the living sitemap --------------------------------------------------------------------------
  async function sitemap(req, res) {
    const host = hostOf(req);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=21600');
    try {
      // Only an explicit 'public' is listed — the sitemap is an invitation, not the gate (the card above still serves the legacy-absent).
      const rows = await withSession(null, async c => (await c.query(`
        SELECT doc->>'lid' AS lid, doc->'updatedAt' AS updated, doc->'createdAt' AS created FROM public.lifetrees WHERE doc->>'visibility'='public' AND length(doc->>'lid')=36
        UNION ALL SELECT doc->>'lid', doc->'updatedAt', doc->'createdAt' FROM public.light_houses WHERE doc->>'visibility'='public' AND length(doc->>'lid')=36
        UNION ALL SELECT doc->>'lid', doc->'updatedAt', doc->'createdAt' FROM public.visions WHERE doc->>'visibility'='public' AND length(doc->>'lid')=36`)).rows);
      const beings = rows.map(r => ({ lid: r.lid, ms: momentMsOf(r.updated) || momentMsOf(r.created) }));
      if (beings.length > SITEMAP_MAX_BEINGS) log.warn(`sitemap: ${beings.length} public beings exceed the ${SITEMAP_MAX_BEINGS}-entry cap; newest kept.`);
      res.writeHead(200); res.end(sitemapXmlOf(host, beings));
    } catch (error) { fault('sitemap', error); res.writeHead(200); res.end(sitemapXmlOf(host, [])); } // never a broken sitemap — home alone stands
  }

  // --- the face feed -------------------------------------------------------------------------------
  async function events(req, res, param) {
    const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    const domain = feedDomainOf(param, hostOf(req).split(':')[0]);
    if (!domain) { send(400, { error: 'domain' }); return; }
    try {
      const feed = await withSession(null, async c => (await c.query('SELECT seed.face_events($1) AS feed', [domain])).rows[0].feed);
      if (!feed) { send(404, { error: 'no cradle at this domain', events: [] }); return; }
      send(200, { domain: feed.domain, events: faceFeedOf(Array.isArray(feed.events) ? feed.events : []) });
    } catch (error) { fault('events', error); send(200, { domain, events: [] }); } // never a broken feed — silence stands in
  }

  return {
    hosts: ownHosts,
    /** @param {{kind: string, door?: string, domain?: string|null}} request */
    async answer(request, req, res) {
      if (request.kind === 'beingCard') return card(req, res, request.door);
      if (request.kind === 'facePicture') return picture(req, res, request.door);
      if (request.kind === 'sitemap') return sitemap(req, res);
      return events(req, res, request.domain);
    },
  };
}
