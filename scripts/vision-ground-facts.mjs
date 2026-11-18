// The origin's facts for the ground migration (ring 2026-11-17, step 4), read ONCE and read-only:
// every vision with its old `lifetreeId`, every tree with the hands that care for it (keeper and
// steward links), every ground already standing. Shared by the dry run
// (scripts/plan-vision-grounds.mjs) and the apply (scripts/apply-vision-grounds.mjs), so both ask
// the shared plan (src/domain/groundMigration.ts) about the same reading.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ms = stamp => (stamp && typeof stamp.toMillis === 'function' ? stamp.toMillis() : typeof stamp === 'number' ? stamp : null);
const text = value => (typeof value === 'string' ? value : null);
// Absent is the legacy 'public'; a value that is not a word is unreadable, which the law hides.
const visibilityOf = value => (value === undefined ? null : text(value) ?? 'unreadable');

/** Open the origin with the keeper's own credentials (serviceAccount.json, else application default). */
export async function openOrigin(projectOption) {
  const app = await import('firebase-admin/app');
  const firestore = await import('firebase-admin/firestore');
  const projectId = projectOption ?? JSON.parse(readFileSync(resolve(root, 'src/config/charter.json'), 'utf8')).firebase?.projectId;
  const localKey = resolve(root, 'serviceAccount.json');
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(localKey)) {
    const account = JSON.parse(readFileSync(localKey, 'utf8'));
    app.initializeApp({ credential: app.cert(account), projectId: account.project_id || projectId });
  } else app.initializeApp({ credential: app.applicationDefault(), projectId });
  return { db: firestore.getFirestore(), projectId, FieldValue: firestore.FieldValue };
}

export const treeFactsOf = (id, t, carerUids) => ({ id, anchorUid: text(t.anchorUid) ?? '', treeType: text(t.treeType), visibility: visibilityOf(t.visibility),
  diedAtMs: t.diedAt ? (ms(t.diedAt) ?? 1) : null, carerUids });
export const visionFactsOf = (id, v) => ({ id, authorId: text(v.authorId) ?? '', title: text(v.title), visibility: visibilityOf(v.visibility),
  lifetreeId: text(v.lifetreeId), createdAtMs: ms(v.createdAt) });

export async function readGroundFacts(db) {
  const [visionSnap, treeSnap, keeperSnap, stewardSnap, groundSnap] = await Promise.all([
    db.collection('visions').get(), db.collection('lifetrees').get(),
    db.collection('links').where('rel', '==', 'keeper').get(), db.collection('links').where('rel', '==', 'steward').get(),
    db.collection('links').where('rel', '==', 'grounded_in').get(),
  ]);
  const carers = new Map();
  for (const snap of [keeperSnap, stewardSnap]) for (const d of snap.docs) {
    const { from, to } = d.data();
    if (typeof from === 'string' && typeof to === 'string') carers.set(to, [...(carers.get(to) ?? []), from]);
  }
  const treeName = new Map(), visionTitle = new Map();
  const trees = treeSnap.docs.map(d => { treeName.set(d.id, text(d.data().name) ?? ''); return treeFactsOf(d.id, d.data(), carers.get(d.id) ?? []); });
  const visions = visionSnap.docs.map(d => { visionTitle.set(d.id, text(d.data().title) ?? ''); return visionFactsOf(d.id, d.data()); });
  const standing = groundSnap.docs.map(d => ({ visionId: String(d.data().from ?? ''), treeId: String(d.data().to ?? '') }));
  return { visions, trees, standing, treeName, visionTitle };
}
