#!/usr/bin/env node
/**
 * Dress the Mahameru vision in the Mahameru sky — sets imageUrl to '/mahameru.svg' (the
 * Orion-over-the-sea mark every imageless vision already wears) on visions whose title
 * matches the given pattern (default: /mahameru/i).
 *
 *   node scripts/set-mahameru-vision-image.mjs             # dry run: list the matches
 *   node scripts/set-mahameru-vision-image.mjs --write     # apply
 *   node scripts/set-mahameru-vision-image.mjs "root vision" --write   # custom title pattern
 *
 * Auth (Admin SDK), same as seed-lightseed.mjs: GOOGLE_APPLICATION_CREDENTIALS, gcloud ADC,
 * or a serviceAccount.json at the repo root.
 */
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Bare ADC (gcloud auth application-default login) often carries no project id, so read it
// from .firebaserc (or an env override) and hand it over explicitly. A serviceAccount.json
// already embeds its own project_id, so that branch needs nothing extra.
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || (() => {
    try { return JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8')).projects?.default; }
    catch { return undefined; }
})();
const saPath = new URL('../serviceAccount.json', import.meta.url);
initializeApp(existsSync(saPath)
    ? { credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) }
    : { credential: applicationDefault(), projectId });

const db = getFirestore();
const args = process.argv.slice(2);
const write = args.includes('--write');
const patternArg = args.find(a => a !== '--write');
const pattern = new RegExp(patternArg || 'mahameru', 'i');

const snap = await db.collection('visions').get();
const matches = snap.docs.filter(d => pattern.test(String(d.data().title || '')));
if (matches.length === 0) {
    console.log(`No visions match ${pattern}. Nothing to change.`);
    process.exit(0);
}
for (const d of matches) {
    const v = d.data();
    console.log(`  ${d.id}  "${v.title}"  image: ${v.imageUrl || '(none)'} -> /mahameru.svg`);
}
if (!write) {
    console.log(`\nDry run (${matches.length} match${matches.length === 1 ? '' : 'es'}). Re-run with --write to apply.`);
    process.exit(0);
}
for (const d of matches) {
    await d.ref.update({ imageUrl: '/mahameru.svg' });
}
console.log(`Updated ${matches.length} vision(s): they wear Mahameru's sky now.`);
