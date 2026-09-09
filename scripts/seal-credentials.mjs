#!/usr/bin/env node
/**
 * Seal the stored provider keys (ring 2026-09-09): every `providerCredentials` row still carrying
 * a plaintext `key` is encrypted under the node's Cloud KMS key (functions/credentialCipher's
 * convention) and the plaintext deleted. Runs with application-default credentials, which must
 * hold cloudkms.cryptoKeyEncrypter on the key (the project owner does). Dry run by default.
 *
 *   node scripts/seal-credentials.mjs            # count and list (hints only, never keys)
 *   node scripts/seal-credentials.mjs --apply
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
// The KMS client lives in the functions' own dependencies (the repo root has no need of it).
const { KeyManagementServiceClient } = createRequire(new URL('../functions/package.json', import.meta.url))('@google-cloud/kms');

const charter = JSON.parse(readFileSync(new URL('../node.json', import.meta.url), 'utf8'));
const KEY = `projects/${charter.firebase.projectId}/locations/${charter.firebase.region}/keyRings/seed/cryptoKeys/provider-credentials`;
const apply = process.argv.includes('--apply');
initializeApp({ credential: applicationDefault(), projectId: charter.firebase.projectId });
const db = getFirestore(); const kms = new KeyManagementServiceClient();

const snap = await db.collection('providerCredentials').get();
let plain = 0, sealed = 0;
for (const d of snap.docs) {
  const r = d.data();
  if (typeof r.keyCiphertext === 'string' && r.keyCiphertext) { sealed++; continue; }
  if (typeof r.key !== 'string' || !r.key) { console.log(`  ? ${d.id}: no key at all`); continue; }
  plain++;
  console.log(`  ${d.id}  (${r.provider}, ${r.scope}, hint ${r.keyHint || '?'})  — plaintext${apply ? ' → sealing' : ''}`);
  if (!apply) continue;
  const [res] = await kms.encrypt({ name: KEY, plaintext: Buffer.from(r.key, 'utf8') });
  await d.ref.set({ keyCiphertext: Buffer.from(res.ciphertext).toString('base64'), keyName: res.name || KEY, key: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
console.log(`${snap.size} credential row(s): ${sealed} already sealed, ${plain} plaintext${apply ? ' — now sealed' : ' (re-run with --apply)'}.`);
