#!/usr/bin/env node

/**
 * Name the nameless: list every document in the six indexed collections that carries no lid
 * (the backfill's `nameless` count, read aloud). READ-ONLY — this script writes nothing.
 *
 * Usage: node scripts/nameless-beings.mjs [--project lifeseed-75dfe]
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const projectId = valueAfter('--project') || 'lifeseed-75dfe';

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const COLLECTIONS = ['users', 'lifetrees', 'visions', 'lightHouses', 'communities', 'pulses'];

// A human hint per kind, so the list reads as beings rather than ids.
const hint = (c, d) => {
  const t = (v) => (typeof v === 'string' ? v.slice(0, 48) : '');
  if (c === 'users') return t(d.displayName) || t(d.email) || '(no name)';
  if (c === 'pulses') return `${d.type || 'pulse'} · ${t(d.title) || t(d.content) || t(d.body) || '—'}`;
  return t(d.name) || t(d.title) || '(no name)';
};
const when = (d) => {
  const ts = d.createdAt;
  const ms = ts?.toMillis?.() ?? (typeof ts === 'number' ? ts : null);
  return ms ? new Date(ms).toISOString().slice(0, 10) : '????-??-??';
};

let total = 0;
for (const c of COLLECTIONS) {
  const snap = await db.collection(c).get();
  const nameless = snap.docs.filter((doc) => !UUID_V7.test(doc.data()?.lid ?? ''));
  if (!nameless.length) continue;
  console.log(`\n${c} — ${nameless.length} nameless:`);
  for (const doc of nameless) {
    const d = doc.data();
    const badLid = d.lid !== undefined ? `  [lid present but malformed: ${JSON.stringify(d.lid).slice(0, 40)}]` : '';
    console.log(`  ${doc.id}  ·  ${when(d)}  ·  ${hint(c, d)}${badLid}`);
    total++;
  }
}
console.log(`\n${total} documents carry no true name.`);
