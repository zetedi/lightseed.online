#!/usr/bin/env node
/**
 * Seed the Phoenix lifetree into the lightseed.online / lifeseed.online node(s).
 *
 * When the "About" page became data-driven, the hard-coded Phoenix story + image were
 * lost. This restores Phoenix as the *first tree* of those communities: a real Lifetree
 * document carrying the story and the /phoenix.webp image, planted with an early date so
 * it sorts ahead of the system genesis seed and shows in the "First Tree" tab.
 *
 * Idempotent — safe to run repeatedly (uses stable doc ids + merge).
 *
 * Auth (Admin SDK — bypasses Firestore rules):
 *   Option A (service account):
 *     export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   Option B (gcloud ADC):
 *     gcloud auth application-default login
 *   Option C: drop a serviceAccount.json next to this repo root.
 *
 * Run:
 *   npm i firebase-admin            # once, if not already installed at root
 *   npm run seed:phoenix            # or: node scripts/seed-phoenix.mjs
 *   node scripts/seed-phoenix.mjs lightseed.online lifeseed.online   # custom domains
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let admin;
try {
  admin = (await import('firebase-admin')).default;
} catch {
  console.error('✗ firebase-admin is not installed.\n  Run:  npm i firebase-admin   (it is already a dependency of ./functions)');
  process.exit(1);
}

const PROJECT_ID = 'lifeseed-75dfe';
const DOMAINS = process.argv.slice(2).length ? process.argv.slice(2) : ['lightseed.online', 'lifeseed.online'];

// The Phoenix story (restored from the former About page).
const PHOENIX_BODY = [
  'Mahameru, the first lifetree died. Its name is Mahameru, the three dimensional representation of the Sri Yantra. The name carried the intention: to connect to the deepest layer of creation and create a new society from there, from the bindu, from the center of the center, from the spiritual heart of the Universe and each and every one of us.',
  "His parent is from Place Jourdain in Brussels and it was planted from a branch. It survived the winter and new lovely leaves sprouted. However the insects loved it too much and I overcared. I've buried it in the same pot where I've planted a new branch of a willow tree from Waterloo.",
  'This is where the name Phoenix is coming from: arising from the death of creation a new Cosmic heartbeat, a new Pulse. By the way Waterloo is the place of the war which ended feudalism and brought peace for a long time.',
  'This is why the first living lifetree is Phoenix, planted with the intention to create a society built from self sustaining intentional symbiotic organisms composed of light, trees, humans and intelligence.',
].join('\n\n');

function initAdmin() {
  const localKey = resolve(process.cwd(), 'serviceAccount.json');
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(localKey)) {
    const sa = JSON.parse(readFileSync(localKey, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id || PROJECT_ID });
    return sa.project_id || PROJECT_ID;
  }
  // GOOGLE_APPLICATION_CREDENTIALS or gcloud application-default credentials.
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
  return PROJECT_ID;
}

async function findCommunityOwner(db, domain) {
  const snap = await db.collection('communities').where('domain', '==', domain).limit(1).get();
  return snap.empty ? null : (snap.docs[0].data().ownerId || null);
}

async function run() {
  const projectId = initAdmin();
  const db = admin.firestore();
  const { Timestamp } = admin.firestore;
  // Early date so Phoenix sorts before the (recent) system genesis seed → shows as First Tree.
  const plantedAt = Timestamp.fromDate(new Date('2021-06-21T00:00:00Z')); // summer solstice

  console.log(`Project: ${projectId}`);
  console.log(`Seeding Phoenix into: ${DOMAINS.join(', ')}\n`);

  for (const domain of DOMAINS) {
    const id = `phoenix-${domain.replace(/[^a-z0-9]/gi, '-')}`;
    const ownerId = (await findCommunityOwner(db, domain)) || 'GENESIS_SYSTEM';

    const tree = {
      name: 'Phoenix',
      shortTitle: 'The First Living Lifetree',
      body: PHOENIX_BODY,
      imageUrl: '/phoenix.webp',
      domain,
      ownerId,
      isNature: true,
      validated: true,
      validatorId: 'SYSTEM',
      latitude: 44.0606,
      longitude: 1.9536,
      locationName: 'Hridaya, France',
      genesisHash: 'PHOENIX',
      latestHash: 'PHOENIX',
      blockHeight: 0,
      createdAt: plantedAt,
    };

    await db.collection('lifetrees').doc(id).set(tree, { merge: true });
    console.log(`✓ ${domain}  →  lifetrees/${id}  (owner: ${ownerId})`);
  }

  console.log('\nDone. The Phoenix story + image now appear under the "First Tree" tab.');
  process.exit(0);
}

run().catch(err => {
  console.error('✗ Seed failed:', err?.message || err);
  console.error('  Check your Admin credentials (see the header of this file).');
  process.exit(1);
});
