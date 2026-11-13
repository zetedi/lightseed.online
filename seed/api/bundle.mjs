// THE CROSSING (ring 2026-11-02): how a whole independent node leaves and arrives. EXPORT reads every
// travelling collection of the bundle law (domain/bundle TRAVEL_PLAN) from the soil through the
// crossing's map (domain/seedBundle), builds the charter head and census, and the custodian seals
// the manifest with an Ed25519 key kept outside the node. IMPORT plans the additive merge with the
// shared law (domain/bundleMerge planBundleMerge: identical records idempotent, differing records
// and LID collisions blocked, local authority never inherited, identities bound by the installation)
// INSIDE one serializable transaction, re-reads the destination there, and lands the plan's inserts
// in that same transaction or nothing at all. Both run as the migration owner — the crossing is an
// installation ceremony like a migration, never a request-serving role's hand.
import pg from 'pg';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { copyFile, link, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { buildCensus, manifestHashOf, verifyBundle, verifyBundleSeal, expectedBeingsIndex, localUidCensus, planBundleMerge,
  BUNDLE_SEAL_TAG, BUNDLE_FORMAT_VERSION, signingPreimage, crossingCharterProblem, mediaConflictsOf } from '../generated/chain.mjs';
import { SEED_BUNDLE_TABLES, bundleReadSql, bundleDocOf, bundleInsertOf } from '../../src/domain/seedBundle.mjs';

// The owner's connection: PG* environment by default (as seed:migrate --local reads it), or explicit.
export const ownerClient = (connection = {}) => new pg.Client({ connectionTimeoutMillis: 10000, ...connection });

// Every travelling record of the soil, as bundle documents, deterministically ordered. An id that
// cannot travel as a path (a slash, a control character) stops the export: silence would be loss.
export async function readSnapshot(client) {
  const docs = [];
  for (const signature of Object.keys(SEED_BUNDLE_TABLES)) {
    const { rows } = await client.query(bundleReadSql(signature));
    for (const row of rows) {
      const doc = bundleDocOf(signature, row);
      if (!doc) throw Object.assign(new Error(`A record of ${signature} has an id that cannot travel as a path.`), { code: 'id_not_portable', signature });
      docs.push(doc);
    }
  }
  return docs.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export const sha256Hex = text => createHash('sha256').update(text, 'utf8').digest('hex');

// What the head binds beside the soil: the commit whose root/ the charter hashes name, and the hashes.
export const exportCommitOf = root => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
export const charterHashesOf = async root => ({
  genesisMd: sha256Hex(await readFile(resolve(root, 'root/GENESIS.md'), 'utf8')),
  linMd: sha256Hex(await readFile(resolve(root, 'root/LIN.md'), 'utf8')),
});

// The bundle from a snapshot: the charter head binds the node's identity and the root's words; the
// beings index travels as a witness computed from the body; admins/config may stay home on request
// (they are local authority the far node never inherits — the planner would refuse them anyway).
// Any node's charter may sign the head — the independent version 2, or the origin's version 1
// (domain/crossingCharter): a node leaves by its travel plan whatever soil it grew in.
// With `media` (domain/mediaCrossing mediaHeadOf), the sidecar's census rides in the head under the seal.
/** @param {{ snapshot: *, charter: *, exportCommit: string, charterHashes: *, exportedAtMs?: number, withoutAuthority?: boolean, media?: { manifests: number, files: number, digest: string } | null }} options */
export async function buildBundle({ snapshot, charter, exportCommit, charterHashes, exportedAtMs = Date.now(), withoutAuthority = false, media = null }) {
  const problem = crossingCharterProblem(charter);
  if (problem) throw Object.assign(new Error(`The charter is not a sound charter for a crossing: ${problem}.`), { code: 'charter_unsound' });
  if (typeof exportCommit !== 'string' || !/^[0-9a-f]{7,64}$/.test(exportCommit)) throw Object.assign(new Error('exportCommit must be a git commit hash.'), { code: 'commit_unsound' });
  for (const name of ['genesisMd', 'linMd']) {
    if (typeof charterHashes?.[name] !== 'string' || !/^[0-9a-f]{64}$/.test(charterHashes[name])) throw Object.assign(new Error('charterHashes must carry sha256 hex of GENESIS.md and LIN.md.'), { code: 'charter_hashes_unsound' });
  }
  const body = snapshot.filter(doc => !(withoutAuthority && /^(admins|config)\//.test(doc.path)));
  const witness = expectedBeingsIndex(body).map(entry => ({ path: `beings/${entry.lid}`, data: { ...entry } }));
  const docs = [...body, ...witness].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const genesis = docs.find(doc => doc.path === 'lifetrees/GENESIS_TREE');
  const g = genesis?.data ?? null;
  const genesisTree = g && typeof g.lid === 'string' && typeof g.genesisHash === 'string' && typeof g.latestHash === 'string'
    ? { docId: 'GENESIS_TREE', lid: g.lid, genesisHash: g.genesisHash, latestHash: g.latestHash, blockHeight: Number(g.blockHeight) || 0 } : null;
  const head = { formatVersion: BUNDLE_FORMAT_VERSION, nodeLid: charter.nodeLid, domain: charter.domain, exportedAtMs,
    exportCommit, charterHashes: { genesisMd: charterHashes.genesisMd, linMd: charterHashes.linMd }, genesisTree, census: await buildCensus(docs),
    ...(media ? { media: { manifests: media.manifests, files: media.files, digest: media.digest } } : {}) };
  return { head, manifestHash: await manifestHashOf(head), docs };
}

// The custodian's seal over the manifest hash, under the bundle's own domain tag (domain/bundle
// BUNDLE_SEAL_TAG), with an Ed25519 private key the installation keeps outside the node (PKCS#8 PEM).
export function custodianOf(privateKeyPem) {
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw Object.assign(new Error('The custodian key must be Ed25519.'), { code: 'key_unsound' });
  const publicKeyB64 = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).toString('base64');
  return { privateKey, publicKeyB64, fingerprint: sha256Hex(publicKeyB64) };
}
export function sealBundle(bundle, custodian) {
  const signature = sign(null, Buffer.from(signingPreimage(BUNDLE_SEAL_TAG, bundle.manifestHash), 'utf8'), custodian.privateKey).toString('base64');
  return { ...bundle, seal: { fingerprint: custodian.fingerprint, signature } };
}
// The sealed bundle lands owner-only and never overwrites; beside it the custodian's PUBLIC anchor
// (<bundle>.anchor.json), to be handed to the receiving node by another road than the bundle.
export async function writeSealedBundle(out, bundle, custodian) {
  await writeFile(out, JSON.stringify(bundle) + '\n', { flag: 'wx', mode: 0o600 });
  await writeFile(out + '.anchor.json', JSON.stringify({ fingerprint: custodian.fingerprint, publicKeyB64: custodian.publicKeyB64 }, null, 2) + '\n', { flag: 'wx', mode: 0o644 });
}
// The verifier the planner is handed: one Ed25519 check over the same preimage the browser builds.
export const sealVerifier = async (publicKeyB64, signatureB64, payload, tag) => {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKeyB64, 'base64'), format: 'der', type: 'spki' });
    return key.asymmetricKeyType === 'ed25519' && verify(null, Buffer.from(signingPreimage(tag, payload), 'utf8'), key, Buffer.from(signatureB64, 'base64'));
  } catch { return false; }
};
export const anchorSound = anchor => !!anchor && typeof anchor.publicKeyB64 === 'string' && typeof anchor.fingerprint === 'string'
  && sha256Hex(anchor.publicKeyB64) === anchor.fingerprint;
export { verifyBundle, verifyBundleSeal, localUidCensus };

// THE CROSSING ITSELF. One serializable transaction under the crossing's advisory lock — the lock
// taken on the SESSION before the transaction opens, so that a second hand arriving at the same
// moment waits, and then reads what the first landed (ring 2026-11-14: a transaction-level lock taken
// as the first statement had fixed the snapshot before the wait, and the late hand planned every
// record again and failed on the first duplicate). The destination is read there (the plan's
// digest is the digest of what the transaction sees), the
// installation's explicit login bindings tell the law which identities are anchored (a person who has
// not spoken here yet may arrive with the import once the installation bound their login by reviewed
// configuration), and with `apply` every planned insert lands — or the whole crossing rolls back.
/** @param {import('pg').Client} client
 * @param {{ incoming: *, anchor: { fingerprint: string, publicKeyB64: string }, identities?: Array<{ sourceUid: string, targetUid: string, personLid?: string, departed?: boolean }>, apply?: boolean, media?: Array<{ path: string, doc: * }> }} crossing */
// THE MEDIA CROSSES (ring 2026-11-03): the sidecar's manifests (verified by the caller against the sealed head
// and the files' own names, the files already in the store) land in the same transaction as the records; a
// manifest standing at the same path with other files is planned as a conflict (domain/mediaCrossing) first.
export async function cross(client, { incoming, anchor, identities = [], apply = false, media = [] }) {
  if (!anchorSound(anchor)) throw Object.assign(new Error('The trusted anchor must carry a public key and its own fingerprint, obtained outside the bundle.'), { code: 'anchor_unsound' });
  await client.query(`SELECT pg_advisory_lock(${CROSSING_LOCK})`);
  try {
    return await crossUnderLock(client, { incoming, anchor, identities, apply, media });
  } finally {
    await client.query(`SELECT pg_advisory_unlock(${CROSSING_LOCK})`).catch(() => undefined);
  }
}
const CROSSING_LOCK = "hashtextextended('lightseed.crossing', 0)";
async function crossUnderLock(client, { incoming, anchor, identities, apply, media }) {
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    const bound = new Set((await client.query("SELECT uid FROM seed.identity_bindings WHERE binding_kind='explicit'")).rows.map(r => r.uid));
    const anchored = identities.map(identity => ({ ...identity, loginBound: bound.has(identity.targetUid) }));
    const destination = await readSnapshot(client);
    let plan = await planBundleMerge(incoming, destination, anchor, sealVerifier, anchored);
    if (media.length) {
      const standing = (await client.query('SELECT path, doc FROM seed.media_objects WHERE path = ANY($1)', [media.map(manifest => manifest.path)])).rows;
      const conflicts = mediaConflictsOf(media, standing);
      if (conflicts.length) plan = { ...plan, issues: [...plan.issues, ...conflicts], ready: false };
    }
    const already = (await client.query('SELECT doc FROM seed.crossings WHERE manifest_hash=$1', [incoming.manifestHash])).rows[0]?.doc ?? null;
    if (!apply || !plan.ready) { await client.query('ROLLBACK'); return { plan, applied: false, already }; }
    let inserted = 0;
    for (const doc of plan.inserts) {
      const statement = bundleInsertOf(doc);
      if (!statement) throw Object.assign(new Error(`A planned record cannot land: ${doc.path}.`), { code: 'doc_unlandable', path: doc.path });
      await client.query(statement.text, statement.values);
      inserted++;
    }
    let pictures = 0;
    for (const manifest of media) {
      const landed = await client.query('INSERT INTO seed.media_objects(path, doc) VALUES ($1, $2::jsonb) ON CONFLICT (path) DO NOTHING', [manifest.path, JSON.stringify(manifest.doc)]);
      pictures += landed.rowCount ?? 0;
    }
    if (!already) {
      await client.query('INSERT INTO seed.crossings(manifest_hash, doc) VALUES ($1, $2::jsonb)', [incoming.manifestHash, JSON.stringify({
        sourceNodeLid: incoming.head.nodeLid, sourceDomain: incoming.head.domain, exportedAtMs: incoming.head.exportedAtMs, exportCommit: incoming.head.exportCommit,
        sealFingerprint: incoming.seal.fingerprint, destinationDigest: plan.destinationDigest, inserted, unchanged: plan.unchanged.length, rebuild: plan.rebuild.length, pictures,
      })]);
    }
    await client.query('COMMIT');
    return { plan, applied: true, inserted, pictures, already };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

// ── THE SIDECAR (ring 2026-11-03): the pictures beside the bundle ───────────────────────────────────
// The manifests of the soil, as the owner reads them (the law chooses which travel: domain/mediaCrossing).
export async function readMediaManifests(client) {
  return (await client.query('SELECT path, doc FROM seed.media_objects ORDER BY path')).rows.map(r => ({ path: r.path, doc: r.doc }));
}
const sha256Bytes = bytes => createHash('sha256').update(bytes).digest('hex');
const storeDirOf = storeDir => {
  if (typeof storeDir !== 'string' || !isAbsolute(storeDir)) throw Object.assign(new Error('SEED_MEDIA_DIR must name the media store by an absolute path.'), { code: 'media_dir_unsound' });
  return storeDir;
};
// The sidecar written beside the bundle: a new directory (never an existing one), one file per hash copied
// from the store, and manifests.json — the head carries their census under the seal.
export async function writeMediaSidecar(dir, sidecar, storeDir) {
  const store = storeDirOf(storeDir);
  await mkdir(dir, { mode: 0o700 });
  for (const hash of sidecar.hashes) await copyFile(join(store, hash), join(dir, hash), fsConstants.COPYFILE_EXCL);
  await writeFile(join(dir, 'manifests.json'), JSON.stringify({ manifests: sidecar.manifests }) + '\n', { flag: 'wx', mode: 0o600 });
}
export async function readMediaSidecar(dir) {
  const parsed = JSON.parse(await readFile(join(dir, 'manifests.json'), 'utf8'));
  if (!parsed || !Array.isArray(parsed.manifests)) throw Object.assign(new Error('The sidecar carries no manifests.json list.'), { code: 'media_sidecar_unsound' });
  return parsed.manifests;
}
// A file beside the bundle stands only when its bytes answer to its name.
export const mediaFilePresent = dir => async hash => {
  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) return false;
  try { return sha256Bytes(await readFile(join(dir, hash))) === hash; } catch { return false; }
};
// The files into the store, by name — each read once, held to its name as it is written (never a window between
// a check and a copy), staged and linked as the store's own publish does; one already there is the same bytes
// (content-addressed) and stays. Returns the hashes this hand placed, so a crossing that does not land can
// withdraw them.
export async function landMediaFiles(dir, storeDir, hashes) {
  const store = storeDirOf(storeDir);
  await mkdir(store, { recursive: true, mode: 0o700 });
  const landed = [];
  for (const hash of hashes) {
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw Object.assign(new Error(`Not a picture's name: ${String(hash).slice(0, 80)}.`), { code: 'media_unsound' });
    const bytes = await readFile(join(dir, hash));
    if (sha256Bytes(bytes) !== hash) throw Object.assign(new Error(`A file beside the bundle does not answer to its name: ${hash}.`), { code: 'media_unsound' });
    const staging = join(store, `.cross-${hash}`);
    await writeFile(staging, bytes, { flag: 'wx', mode: 0o600 });
    try { await link(staging, join(store, hash)); landed.push(hash); }
    catch (error) { if (error?.code !== 'EEXIST') throw error; }
    finally { await unlink(staging); }
  }
  return landed;
}
// The files a hand placed, taken back when its crossing did not land (nothing names them; the sweep frees only marked orphans).
export async function withdrawMediaFiles(storeDir, hashes) {
  const store = storeDirOf(storeDir);
  for (const hash of hashes) if (/^[a-f0-9]{64}$/.test(hash)) await unlink(join(store, hash)).catch(() => undefined);
}
