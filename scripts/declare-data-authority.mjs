#!/usr/bin/env node

/**
 * Declare which node governs the current Firestore backend.
 *
 * Usage:
 *   npm run authority:declare -- --project <firebase-project-id> --domain <community-domain>
 *
 * Uses Application Default Credentials. The declaration is create-once: changing a
 * backend's sovereign node deserves a separate, governed transfer rather than --force.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const projectId = valueAfter('--project');
const domain = valueAfter('--domain')?.toLowerCase().replace(/^www\./, '');
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

if (!projectId || !domain) {
  console.error('Usage: npm run authority:declare -- --project <firebase-project-id> --domain <community-domain>');
  process.exit(1);
}
if (!stdin.isTTY) {
  console.error('Refusing a non-interactive authority declaration.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const store = getFirestore();
const authorityRef = store.doc('config/dataAuthority');
const existing = await authorityRef.get();

if (existing.exists) {
  console.error('This backend already has a data authority declaration:');
  console.error(JSON.stringify(existing.data(), null, 2));
  console.error('No change was made. Authority transfer needs its own governed process.');
  process.exit(1);
}

const matches = await store.collection('communities').where('domain', '==', domain).limit(2).get();
if (matches.size !== 1) {
  console.error(`Expected exactly one community with domain "${domain}"; found ${matches.size}.`);
  process.exit(1);
}

const community = matches.docs[0].data();
if (!UUID_V7.test(community.lid || '')) {
  console.error(`The community at "${domain}" has no canonical UUIDv7 LID.`);
  process.exit(1);
}

console.log(`Backend:  ${projectId}`);
console.log(`Node:     ${community.name || domain}`);
console.log(`Domain:   ${domain}`);
console.log(`Node LID: ${community.lid}`);
console.log('');
console.log('This makes the community the named governor of this backend.');
console.log('Its menu will read The Node while scoped, or The Hub while reflecting.');

const prompt = createInterface({ input: stdin, output: stdout });
const confirmation = await prompt.question(`Type the full node LID to declare this authority: `);
prompt.close();

if (confirmation.trim() !== community.lid) {
  console.error('Declaration cancelled; the LID did not match.');
  process.exit(1);
}

await authorityRef.create({
  version: 1,
  nodeLid: community.lid,
  declaredAt: FieldValue.serverTimestamp(),
});

console.log('✓ Data authority declared. Deploy the updated rules before the public app reads it.');
