#!/usr/bin/env node
/**
 * Seed the Per Auset community — the first custom-landing organisation on the seed.
 *
 *   - Community doc `communities/per-auset` with the yellow-turquoise ibis palette,
 *     the ibis hero (/custom/per-auset/hero.webp) and customLanding: true.
 *   - Domain starts at perauset.web.app; pass the real domain later to move it
 *     (trees planted on the domain follow community.domain automatically).
 *
 * Idempotent (stable id + merge). Auth like seed-lightseed.mjs (Admin SDK):
 *   gcloud auth application-default login   (or GOOGLE_APPLICATION_CREDENTIALS / serviceAccount.json)
 *
 * Run:
 *   node scripts/seed-perauset.mjs                    # domain perauset.web.app
 *   node scripts/seed-perauset.mjs perauset.com       # move to the real domain later
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let admin;
try {
  admin = (await import('firebase-admin')).default;
} catch {
  console.error('✗ firebase-admin is not installed.\n  Run:  npm i firebase-admin');
  process.exit(1);
}

const PROJECT_ID = 'lifeseed-75dfe';
const DOMAIN = process.argv[2] || 'perauset.web.app';

// The ibis palette — golden sun-disc, teal lotus, parchment sky.
const THEME = {
  primary: '#0f766e',    // lotus teal — actions, links
  secondary: '#ca8a04',  // harp gold — secondary actions
  accent: '#eab308',     // sun gold — highlights, the corner-seed glow
  neutral: '#44403c',    // warm stone ink
  background: '#faf5e9', // parchment
  surface: '#ffffff',
  text: '#292524',
  mode: 'light',
};

function initAdmin() {
  const localKey = resolve(process.cwd(), 'serviceAccount.json');
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(localKey)) {
    const sa = JSON.parse(readFileSync(localKey, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id || PROJECT_ID });
    return sa.project_id || PROJECT_ID;
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
  return PROJECT_ID;
}

async function run() {
  const projectId = initAdmin();
  const db = admin.firestore();

  const superadmin = await db.collection('config').doc('superadmin').get();
  const ownerId = (superadmin.exists && superadmin.data().uid) || 'GENESIS_SYSTEM';

  await db.collection('communities').doc('per-auset').set({
    name: 'Per Auset',
    domain: DOMAIN,
    vision: 'The house of Auset — a vision, a community, a garden of souls.',
    imageUrls: [],
    ownerId,
    theme: THEME,
    heroImageUrl: '/custom/per-auset/hero.webp',
    customLanding: true,
    visibility: 'public',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`Project: ${projectId}`);
  console.log(`✓ communities/per-auset  →  domain ${DOMAIN}, customLanding on, ibis palette (owner: ${ownerId})`);
  console.log('\nNext: firebase hosting:sites:create perauset && firebase target:apply hosting perauset perauset && firebase deploy --only hosting');
  process.exit(0);
}

run().catch(err => {
  console.error('✗ Seed failed:', err?.message || err);
  process.exit(1);
});
