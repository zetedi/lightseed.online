#!/usr/bin/env node

/**
 * Face OG (ring 2026-08-16, made structural 2026-09-30): each hosting face wears ITS
 * community's Open Graph card. Hosting serves the static index.html for "/" before any
 * rewrite can fire, so the front door cannot be dressed at runtime the way /b/ beings are.
 * Instead every face is served from ITS OWN COPY of the build — dist-faces/<target> — and
 * this script makes that copy from dist/ and bakes the community's name, vision and hero
 * into its index.html. It runs as the face's own PREDEPLOY hook (firebase.json, derived from
 * the charter), so a plain `firebase deploy --only hosting` dresses every face correctly and
 * nothing can undress one again.
 *
 *   node scripts/face-og.mjs <target>     # one face: copy dist → dist-faces/<target>, dress it
 *   node scripts/face-og.mjs --all        # every face but the first (after a build)
 *
 * A face whose community cannot be read (no credentials, no community yet) keeps the app's
 * default card rather than failing the deploy: the copy is still made, and a warning is said.
 */
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const charter = JSON.parse(readFileSync(new URL('../node.json', import.meta.url), 'utf8'));
const faces = charter.faces.slice(1); // the first face is the app itself, served from dist/
const arg = process.argv[2];
if (!arg) { console.error('face-og: name a face target, or --all.'); process.exit(1); }
const targets = arg === '--all' ? faces.map((f) => f.target) : [arg];
if (!existsSync('dist/index.html')) { console.error('face-og: no dist/index.html — build first.'); process.exit(1); }

const strip = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim();
const truncate = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// The vision is the first paper (domain/papers visionOf) — the vision FIELD retired 2026-09-21.
const visionOf = (c) => (Array.isArray(c?.papers) ? c.papers : []).find((p) => p?.key === 'vision')?.html || '';

let db = null;
try { initializeApp({ credential: applicationDefault(), projectId: charter.firebase.projectId }); db = getFirestore(); } catch (e) { console.warn(`face-og: no database hand (${e.message}); faces keep the default card.`); }

const communityAt = async (domain) => {
  if (!db) return null;
  try {
    let snap = await db.collection('communities').where('domain', '==', domain).limit(1).get();
    if (snap.empty) snap = await db.collection('communities').where('domainAliases', 'array-contains', domain).limit(1).get();
    return snap.empty ? null : snap.docs[0].data();
  } catch (e) { console.warn(`face-og: could not read the community at ${domain} (${e.message}).`); return null; }
};

for (const target of targets) {
  const face = faces.find((f) => f.target === target);
  if (!face) { console.error(`face-og: unknown face '${target}' — the charter (node.json) names the faces.`); process.exit(1); }
  const dir = `dist-faces/${target}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync('dist-faces', { recursive: true });
  cpSync('dist', dir, { recursive: true });
  const domain = face.door;
  const c = await communityAt(domain);
  if (!c) { console.warn(`face-og: ${target} keeps the default card (no community at ${domain}).`); continue; }

  const name = c.name || domain;
  const description = truncate(strip(visionOf(c)) || `${name} — a living community on the Lifetree Network.`, 160);
  const sectionImage = (Array.isArray(c.landingSections) ? c.landingSections : [])
    .map((s) => s?.props?.imageUrl).find((u) => typeof u === 'string' && /^https:\/\//.test(u));
  const rawImage = c.heroImageUrl || sectionImage || '/og.png';
  const image = /^https?:\/\//.test(rawImage) ? rawImage : `https://${domain}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;
  const url = `https://${domain}`;

  const p = `${dir}/index.html`;
  let html = readFileSync(p, 'utf8');
  const swaps = [
    [/<title>[^<]*<\/title>/, `<title>${esc(name)}</title>`],
    [/(<meta property="og:site_name" content=")[^"]*(")/, `$1${esc(name)}$2`],
    [/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(name)}$2`],
    [/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`],
    [/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`],
    [/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(image)}$2`],
    [/(<meta property="og:image:alt" content=")[^"]*(")/, `$1${esc(name)}$2`],
    [/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`],
    [/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(name)}$2`],
    [/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(description)}$2`],
    [/(<meta name="twitter:image" content=")[^"]*(")/, `$1${esc(image)}$2`],
  ];
  // A hero that is not a PNG must not keep the static og.png's dimensions and type.
  if (!/\/og\.png$/.test(image)) html = html.replace(/\n?\s*<meta property="og:image:(?:type|width|height)" content="[^"]*" \/>/g, '');
  let applied = 0;
  for (const [re, sub] of swaps) if (re.test(html)) { html = html.replace(re, sub); applied++; }
  writeFileSync(p, html);
  console.log(`face-og: ${target} wears '${name}' (${applied} tags, image ${image.slice(0, 60)}…).`);
}
process.exit(0);
