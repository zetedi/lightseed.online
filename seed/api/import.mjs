#!/usr/bin/env node
// seed:import — a sealed bundle arrives by additive merge (ring 2026-11-02).
//   npm run seed:import -- bundle.json --anchor anchor.json [--identities identities.json] [--vouch-departed departed.json] [--media <dir>] [--report report.json] [--apply]
// Connects as the migration owner through the PG* environment. Without --apply this only PLANS:
// the proposal is printed (and written to --report, owner-only, never overwriting). With --apply and
// no planning conflict, every planned record lands in one transaction. identities.json is an array
// of { "sourceUid", "targetUid", "personLid" } the installation vouches for; a uid whose login the
// installation bound by reviewed configuration (an explicit binding in the auth trust file) may
// arrive before the person has spoken here. --vouch-departed names a JSON array of uids the hand
// vouches DEPARTED (no person on either side, no login; their traces travel as names only) — the
// vouch is this hand's, never the exporter's. With --media <dir>, THE PICTURES beside the bundle are
// held to the sealed head and to each file's own name, a picture already standing here under another
// bundle path is planned as a conflict, the files land in SEED_MEDIA_DIR before the records and are
// withdrawn if the crossing does not land (each under its hash's lock, and only while no manifest names
// it), and the manifests land in the records' transaction under the same locks the publish and the
// sweep take. Once the transaction has committed nothing is withdrawn, whatever fails afterwards.
// Exit 0 = clear (or applied), 2 = blocked, 1 = error.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ownerClient, cross, localUidCensus, readMediaSidecar, mediaFilePresent, landMediaFiles, withdrawMediaFiles, mediaFileStands } from './bundle.mjs';
import { mediaSidecarIssues, mediaHashesOf } from '../generated/chain.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const named = ['--anchor', '--identities', '--vouch-departed', '--report', '--media'];
const positional = args.filter((a, i) => !a.startsWith('--') && !named.includes(args[i - 1]));
if (positional.length !== 1 || !option('--anchor') || args.some(a => a.startsWith('--') && ![...named, '--apply'].includes(a))) {
  console.error('Usage: npm run seed:import -- bundle.json --anchor anchor.json [--identities identities.json] [--vouch-departed departed.json] [--media <dir>] [--report report.json] [--apply]');
  process.exit(1);
}
const readJson = async path => {
  const absolute = resolve(path);
  if ((await stat(absolute)).size > 256 * 1024 * 1024) throw new Error('Input exceeds the 256 MiB limit.');
  return JSON.parse(await readFile(absolute, 'utf8'));
};
const client = ownerClient();
let landed = []; // the pictures this hand placed in the store — withdrawn unless the crossing lands
let connected = false;
try {
  const incoming = await readJson(positional[0]);
  const anchor = await readJson(option('--anchor'));
  const identities = option('--identities') ? await readJson(option('--identities')) : [];
  const vouched = option('--vouch-departed') ? await readJson(option('--vouch-departed')) : [];
  if (!incoming?.head || !Array.isArray(incoming.docs) || typeof incoming.manifestHash !== 'string' || !incoming.seal) throw new Error('Expected a sealed NodeBundle.');
  // Each identity binds a uid to itself with its person LID — or vouches the uid DEPARTED (no person, no login; its traces travel as names).
  const sound = i => i && typeof i === 'object' && ['sourceUid', 'targetUid'].every(k => typeof i[k] === 'string' && i[k])
    && (i.departed === true ? i.personLid === undefined : typeof i.personLid === 'string' && i.personLid.length > 0);
  if (!Array.isArray(identities) || !identities.every(sound)) {
    throw new Error('Each identity binding needs sourceUid, targetUid and personLid — or departed: true in place of a person.');
  }
  if (!Array.isArray(vouched) || !vouched.every(uid => typeof uid === 'string' && uid.length > 0 && uid.length <= 128)) throw new Error('--vouch-departed names a JSON array of uids.');
  for (const uid of vouched) identities.push({ sourceUid: uid, targetUid: uid, departed: true });
  // The pictures beside the bundle: held to the sealed head and to each file's own name before anything lands.
  const mediaDir = option('--media') !== undefined ? resolve(option('--media')) : null;
  let manifests = [];
  if (mediaDir) {
    manifests = await readMediaSidecar(mediaDir);
    const issues = await mediaSidecarIssues(incoming.head.media, manifests, mediaFilePresent(mediaDir));
    if (issues.length) {
      console.error(`The pictures beside the bundle do not verify (${issues.length} issues):`);
      for (const issue of issues.slice(0, 20)) console.error(`  ${issue.code}${issue.detail ? ': ' + issue.detail : ''}`);
      throw Object.assign(new Error('The crossing stops here: the pictures do not verify.'), { code: 'media_unsound' });
    }
  } else if (incoming.head?.media?.manifests > 0) console.warn(`The bundle names ${incoming.head.media.manifests} pictures; pass --media <dir> (with SEED_MEDIA_DIR) to carry them.`);
  const apply = args.includes('--apply');
  // The files first, by name, into the store — a manifest never names a file that is not there.
  // The soil is reached first: a hand that cannot reach it places nothing it could not take back under the locks.
  await client.connect(); connected = true;
  if (apply && mediaDir) landed = await landMediaFiles(mediaDir, process.env.SEED_MEDIA_DIR, mediaHashesOf(manifests));
  const { plan, applied, inserted, pictures, already } = await cross(client, { incoming, anchor, identities, apply, media: manifests, mediaStands: apply && mediaDir ? mediaFileStands(process.env.SEED_MEDIA_DIR) : undefined });
  // THE CROSSING LANDED: from here the files are the soil's (2026-11-15) — a report that cannot be written, or
  // anything else that fails below, must never take back what committed manifests name.
  const placed = landed.length;
  if (applied) landed = [];
  if (option('--report')) await writeFile(resolve(option('--report')), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const unbound = plan.issues.filter(i => i.code === 'identity_unbound').length;
  console.log(`Merge proposal ${plan.ready ? 'has no planning conflicts' : 'is blocked'}: ${plan.inserts.length} records to land, ${plan.unchanged.length} unchanged, ${plan.rebuild.length} witnesses, ${plan.issues.length} issues.`);
  for (const issue of plan.issues.slice(0, 40)) console.log(`  ${issue.code}${issue.path ? ' ' + issue.path : ''}: ${issue.detail}`);
  if (plan.issues.length > 40) console.log(`  … ${plan.issues.length - 40} more (see --report).`);
  if (unbound) console.log(`Identities needing a binding (${unbound}): ${localUidCensus(incoming.docs).join(', ')}`);
  if (already) console.log(`This bundle already crossed here on ${already.exportedAtMs ? new Date(already.exportedAtMs).toISOString() : 'an earlier day'}.`);
  if (applied) {
    console.log(`Applied: ${inserted} records landed in one transaction${mediaDir ? `, ${pictures} pictures with them (${placed} files new in the store)` : ''}.`);
  } else if (plan.ready) console.log('Nothing written: pass --apply to land the proposal.');
  process.exitCode = plan.ready ? 0 : 2;
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Invalid JSON input.' : error instanceof Error ? error.message : 'Import failed.');
  process.exitCode = error?.code === 'media_unsound' ? 2 : 1;
} finally {
  if (landed.length) {
    try {
      if (!connected) throw new Error('no soil to ask');
      const { withdrawn, named } = await withdrawMediaFiles(client, process.env.SEED_MEDIA_DIR, landed);
      console.log(`The crossing did not land: ${withdrawn.length} files this hand had placed in the store were withdrawn${named.length ? `, ${named.length} stay because a picture published meanwhile names them` : ''}.`);
    } catch {
      console.error(`The crossing did not land, and the ${landed.length} files this hand had placed in the store could not be withdrawn under their locks: they stand unnamed in SEED_MEDIA_DIR (the next import of this bundle names them).`);
    }
  }
  await client.end().catch(() => undefined);
}
