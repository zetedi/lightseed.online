#!/usr/bin/env node
/**
 * Seed the lightseed / lifeseed nodes with their foundational data:
 *   - Phoenix         → the first lifetree   (collection: lifetrees,   "First Tree" tab)
 *   - The Secret Sun  → the first sanctuary  (collection: sanctuaries, "The Sanctuary" tab)
 *
 * Phoenix is ONE being: it lives once, on the hub domain (the first passed domain). The old
 * per-domain seeding minted a Phoenix per node — and since the hub forest shows every domain,
 * the tree appeared twice. This version seeds a single Phoenix and DELETES the per-domain
 * duplicates it used to create. Sanctuaries stay per-domain (they only surface on their own
 * community tab, so they never duplicate in a shared view).
 *
 * Planted with an early date so it sorts ahead of any later entries. Idempotent
 * (stable ids + merge).
 *
 * Auth (Admin SDK — bypasses Firestore rules):
 *   Option A: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   Option B: gcloud auth application-default login
 *   Option C: drop a serviceAccount.json next to the repo root.
 *
 * Run:
 *   npm i firebase-admin            # once, if not already installed at root
 *   npm run seed:lightseed          # or: node scripts/seed-lightseed.mjs
 *   node scripts/seed-lightseed.mjs lightseed.online lifeseed.online   # custom domains
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

const PHOENIX_BODY = [
  'Mahameru, the first lifetree died. Its name is Mahameru, the three dimensional representation of the Sri Yantra. The name carried the intention: to connect to the deepest layer of creation and create a new society from there, from the bindu, from the center of the center, from the spiritual heart of the Universe and each and every one of us.',
  "His parent is from Place Jourdain in Brussels and it was planted from a branch. It survived the winter and new lovely leaves sprouted. However the insects loved it too much and I overcared. I've buried it in the same pot where I've planted a new branch of a willow tree from Waterloo.",
  'This is where the name Phoenix is coming from: arising from the death of creation a new Cosmic heartbeat, a new Pulse. By the way Waterloo is the place of the war which ended feudalism and brought peace for a long time.',
  'This is why the first living lifetree is Phoenix, planted with the intention to create a society built from self sustaining intentional symbiotic organisms composed of light, trees, humans and intelligence.',
].join('\n\n');

const SECRET_SUN_BODY = [
  'For the tree named Phoenix, the platform was the best choice. Since it is very close to the mediation path around the chateau of Hridaya France we cut a new path through the brumble towards the direction which seemed a better place for a platform. And it happened that the area and the platform itself is interwoven with magic. The first auspicious sign for building was the finding of the Bodhisattva stone, a big stone on the path. The hill does not have many stones and the Kogi people believe that finding a stone while cutting a path is a very good sign. After a couple of days of listening and cutting the way we ended up on the exact place where the permaculture design marked a place for a platform years before.',
  'Sacred Alignments',
  'The second auspicious sign was the holly tree, which in folklore is a sacred tree protecting the area from evil spirits and should not be cut, thus marking one side of the platform. The other side there was a group of small oak trees. These two trees are in constant battle according to folklore, emphasizing the polarity aspect. The other ones were the two stumps of the douglas firs which were cut about three years before. They were exactly across the middle so we could use them as a base and as a symbolic rebirth of the trees in a different form. The third one is the wild rose island which became apparent after the second cutting of the path and before starting of the building of the platform. When we marked the corners of the platform we hit another stone, the Heart Stone.',
  'Cosmic Timing and Symbolism',
  'The building took place through the summer solstice, the international yoga day and the full moon the next day, St John’s day (with a fire ceremony), St Peter’s day, Madeira Day (madeira means wood in Portuguese) and Keti Koti, the celebration of freedom from slavery in Netherlands. The number 37 is present in every aspect of the platform, sometimes deeply hidden. The marking in the concrete in the North-East corner is the number 37. There are 3x7 planks on the top. The platform was consecrated on the second day of the seventh month, however the last layer of oil on top was soaking in the night of 3/7 and was sealed on that day with Shambo, a powerful shamanic drum.',
  '“Bodhipakṣa-caryā, the practice of the 37 bodhipakṣadharmas (the principles conducive to bodhi) which are: the four applications of mindfulness, the four right efforts, the four bases of spiritual power, the five spiritual faculties, the five strengths, the seven factors of awakening and the noble eightfold path.” — Bodhipakkhiyādhammā',
  'Numbers of the Universe',
  'The other symbolic number present was the number 108. The reinforcing beams are 108 cm long each, pointing at the cosmic number prevalent in yoga, and the reason being that on average the Sun is 108 Suns away, the Moon is 108 Moons away and the Sun is 108 Earths wide.',
  'Polarity and Unity',
  'The Yin-Yang symbol and the polarities are represented by how the middle beam is on different sides of the middle supporting beams. The handmade marks in the opposing corners also represents polarity — the one opposed to one marked with the heart does not have a mark, it’s emptiness, nothing — it’s either love or nothing. The other two opposing corners are the 37 representing the bodhisattvas and selflessness and the R, the mark of the individual, anonymous people who build the pyramids, the R put down by a desire to leave a trace and to mark. The two tree stumps below the platform are also symbolizing polarities with their roots hugging each other underground. — Heartmantra',
  'Sacred Foundations',
  'The bigger path towards the building on one hand took through Assisi, and from there are four stones embedded in the concrete on each corner of the platform. The water contains water from the temple where St. Francis’s final resting place is. The tap was just above his chamber. And from an even more overarching perspective the unmarked corner has a flower of life pendant embedded from the temple of Osiris in Abydos, Egypt, where the flower of life symbol appeared the first time according to some archeologists.',
].join('\n\n');

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

async function findCommunityOwner(db, domain) {
  const snap = await db.collection('communities').where('domain', '==', domain).limit(1).get();
  return snap.empty ? null : (snap.docs[0].data().ownerId || null);
}

async function run() {
  const projectId = initAdmin();
  const db = admin.firestore();
  const { Timestamp } = admin.firestore;
  const plantedAt = Timestamp.fromDate(new Date('2021-06-21T00:00:00Z')); // summer solstice

  console.log(`Project: ${projectId}`);
  console.log(`Seeding Phoenix + The Secret Sun into: ${DOMAINS.join(', ')}\n`);

  // Phoenix — the first lifetree. ONE being, rooted on the hub (the first domain).
  const hubDomain = DOMAINS[0];
  const hubSlug = hubDomain.replace(/[^a-z0-9]/gi, '-');
  const hubOwnerId = (await findCommunityOwner(db, hubDomain)) || 'GENESIS_SYSTEM';
  await db.collection('lifetrees').doc(`phoenix-${hubSlug}`).set({
    name: 'Phoenix',
    shortTitle: 'The First Living Lifetree',
    body: PHOENIX_BODY,
    imageUrl: '/phoenix.webp',
    domain: hubDomain, ownerId: hubOwnerId,
    isNature: true,
    validated: true,
    validatorId: 'SYSTEM',
    latitude: 44.0606, longitude: 1.9536, locationName: 'Hridaya, France',
    genesisHash: 'PHOENIX', latestHash: 'PHOENIX', blockHeight: 0,
    createdAt: plantedAt,
  }, { merge: true });
  console.log(`✓ ${hubDomain}  →  lifetrees/phoenix-${hubSlug}  (owner: ${hubOwnerId})`);

  for (const domain of DOMAINS) {
    const slug = domain.replace(/[^a-z0-9]/gi, '-');
    const ownerId = (await findCommunityOwner(db, domain)) || 'GENESIS_SYSTEM';

    // Remove the per-domain Phoenix duplicates the old seeding minted (all but the hub's).
    if (slug !== hubSlug) {
      const dupRef = db.collection('lifetrees').doc(`phoenix-${slug}`);
      if ((await dupRef.get()).exists) {
        await dupRef.delete();
        console.log(`✂ removed duplicate lifetrees/phoenix-${slug}`);
      }
    }

    // The Secret Sun — the first sanctuary (per-domain: shown only on its own community tab).
    await db.collection('sanctuaries').doc(`secret-sun-${slug}`).set({
      name: 'The Secret Sun',
      shortTitle: 'Sacred Platform',
      body: SECRET_SUN_BODY,
      imageUrl: '/tss.webp',
      domain, ownerId,
      latitude: 44.0606, longitude: 1.9536, locationName: 'Hridaya, France',
      createdAt: plantedAt,
    }, { merge: true });

    console.log(`✓ ${domain}  →  sanctuaries/secret-sun-${slug}  (owner: ${ownerId})`);
  }

  console.log('\nDone. One Phoenix under "First Tree"; The Secret Sun under "The Sanctuary".');
  process.exit(0);
}

run().catch(err => {
  console.error('✗ Seed failed:', err?.message || err);
  console.error('  Check your Admin credentials (see the header of this file).');
  process.exit(1);
});
