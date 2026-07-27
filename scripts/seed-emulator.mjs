#!/usr/bin/env node

/**
 * Seed the LOCAL Firebase emulator with a small living forest, so `npm run devui` starts
 * with populated feeds instead of an empty world.
 *
 * Run while the emulators are up (npm run devui in another terminal):
 *   npm run devui:seed
 *
 * SAFETY: this script can only ever speak to the emulator. The emulator hosts are hardcoded
 * into the environment BEFORE the admin SDK loads, and we ping the emulator first; if it is
 * not running, we exit without touching anything. Production is unreachable by construction.
 */

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';

const ping = await fetch('http://127.0.0.1:8080/').catch(() => null);
if (!ping) {
  console.error('The Firestore emulator is not running. Start it first: npm run devui');
  process.exit(1);
}

const { initializeApp } = await import('firebase-admin/app');
const { getFirestore, Timestamp } = await import('firebase-admin/firestore');

// Must match the web SDK's projectId so both sides share one emulator namespace.
initializeApp({ projectId: 'lifeseed-75dfe' });
const db = getFirestore();

// A tiny local uuidv7 (mirror of src/utils/id.ts; scripts cannot import TS).
import { randomBytes } from 'node:crypto';
const uuidv7 = (at = Date.now()) => {
  const b = Buffer.concat([Buffer.alloc(6), randomBytes(10)]);
  let ts = Math.max(0, Math.floor(at));
  for (let i = 5; i >= 0; i--) { b[i] = ts % 256; ts = Math.floor(ts / 256); }
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

const now = Timestamp.now();
const demoUid = 'demo-gardener';

// Idempotent-ish: a marker doc says the forest was already seeded.
const marker = db.doc('config/emulatorSeed');
if ((await marker.get()).exists) {
  console.log('The local forest is already seeded. Delete ./.emulator-data to start fresh.');
  process.exit(0);
}

const batch = db.batch();

// A person + user for the demo gardener (sign in with any emulator account to be yourself).
batch.set(db.doc(`persons/${demoUid}`), { uid: demoUid, lid: uuidv7(), displayName: 'Demo Gardener' });
batch.set(db.doc(`users/${demoUid}`), { uid: demoUid, email: 'gardener@demo.local', displayName: 'Demo Gardener', invitesRemaining: 12, emailNotifications: {}, newsletterSubscribed: false });

// A community with an open door.
const com = db.collection('communities').doc();
batch.set(com, {
  lid: uuidv7(), ownerId: demoUid, name: 'Riverside Grove', domain: 'grove.local',
  vision: 'A small grove by the river where every tree is known by name.',
  door: 'open', reflectsPublic: false, createdAt: now, updatedAt: now, loveCount: 0,
});

// Three trees with places (the map needs coordinates).
const trees = [
  { name: 'Old Willow', lat: 47.4979, lng: 19.0402, body: 'The willow by the bridge.' },
  { name: 'North Oak', lat: 48.2082, lng: 16.3738, body: 'An oak that remembers winters.' },
  { name: 'Fig of the Yard', lat: 41.9028, lng: 12.4964, body: 'Figs in late August, always.' },
];
const treeIds = [];
for (const t of trees) {
  const ref = db.collection('lifetrees').doc();
  treeIds.push(ref.id);
  batch.set(ref, {
    lid: uuidv7(), ownerId: demoUid, name: t.name, body: t.body,
    latitude: t.lat, longitude: t.lng, locationName: 'Demo grove',
    communityId: com.id, visibility: 'public', validated: false, validatorId: null,
    genesisHash: 'demo', latestHash: 'demo', blockHeight: 0, status: 'HEALTHY',
    createdAt: now, updatedAt: now, loveCount: 0,
  });
}

// An event, an offering (with the switch and a door), and a vision, so every tab breathes.
batch.set(db.collection('pulses').doc(), {
  lid: uuidv7(), type: 'event', domain: 'localhost', title: 'River cleanup morning', body: 'Gloves provided.',
  content: 'Gloves provided.', authorId: demoUid, authorName: 'Demo Gardener',
  lifetreeId: treeIds[0], communityId: com.id, communityName: 'Riverside Grove',
  eventDate: new Date(Date.now() + 7 * 86400000).toISOString(), eventLocation: 'The bridge',
  visibility: 'public', hash: 'demo', previousHash: 'EVENT', createdAt: now, loveCount: 0, commentCount: 0,
});
batch.set(db.collection('pulses').doc(), {
  lid: uuidv7(), type: 'offering', domain: 'localhost', offeringKind: 'service', title: 'Bicycle repair hour',
  body: 'Bring your bike, leave with round wheels.', content: 'Bring your bike, leave with round wheels.',
  authorId: demoUid, authorName: 'Demo Gardener', offeringAppreciationLight: 108,
  offeringActive: true, offeringUrl: 'https://example.org/repairs',
  visibility: 'public', hash: 'demo', previousHash: 'OFFERING', createdAt: now, loveCount: 0, commentCount: 0,
});
batch.set(db.collection('visions').doc(), {
  lid: uuidv7(), authorId: demoUid, domain: 'localhost', title: 'A tool library in every grove',
  body: 'Shared spades outlive private sheds.', visibility: 'public',
  genesisHash: 'demo', latestHash: 'demo', blockHeight: 0, createdAt: now, loveCount: 0,
});

batch.set(marker, { seededAt: now, note: 'local emulator seed; never exists in production' });
await batch.commit();
console.log('✓ The local forest is planted: 1 community, 3 trees, 1 event, 1 offering, 1 vision.');
console.log('  Sign in through the emulator with any made-up account and walk it.');
