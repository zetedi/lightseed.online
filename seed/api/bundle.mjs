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
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildCensus, manifestHashOf, verifyBundle, verifyBundleSeal, expectedBeingsIndex, localUidCensus, planBundleMerge,
  BUNDLE_SEAL_TAG, BUNDLE_FORMAT_VERSION, signingPreimage, crossingCharterProblem } from '../generated/chain.mjs';
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
export async function buildBundle({ snapshot, charter, exportCommit, charterHashes, exportedAtMs = Date.now(), withoutAuthority = false }) {
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
    exportCommit, charterHashes: { genesisMd: charterHashes.genesisMd, linMd: charterHashes.linMd }, genesisTree, census: await buildCensus(docs) };
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

// THE CROSSING ITSELF. One serializable transaction under the crossing's advisory lock: the
// destination is read there (the plan's digest is the digest of what the transaction sees), the
// installation's explicit login bindings tell the law which identities are anchored (a person who has
// not spoken here yet may arrive with the import once the installation bound their login by reviewed
// configuration), and with `apply` every planned insert lands — or the whole crossing rolls back.
/** @param {import('pg').Client} client
 * @param {{ incoming: *, anchor: { fingerprint: string, publicKeyB64: string }, identities?: Array<{ sourceUid: string, targetUid: string, personLid: string }>, apply?: boolean }} crossing */
export async function cross(client, { incoming, anchor, identities = [], apply = false }) {
  if (!anchorSound(anchor)) throw Object.assign(new Error('The trusted anchor must carry a public key and its own fingerprint, obtained outside the bundle.'), { code: 'anchor_unsound' });
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('lightseed.crossing', 0))");
    const bound = new Set((await client.query("SELECT uid FROM seed.identity_bindings WHERE binding_kind='explicit'")).rows.map(r => r.uid));
    const anchored = identities.map(identity => ({ ...identity, loginBound: bound.has(identity.targetUid) }));
    const destination = await readSnapshot(client);
    const plan = await planBundleMerge(incoming, destination, anchor, sealVerifier, anchored);
    const already = (await client.query('SELECT doc FROM seed.crossings WHERE manifest_hash=$1', [incoming.manifestHash])).rows[0]?.doc ?? null;
    if (!apply || !plan.ready) { await client.query('ROLLBACK'); return { plan, applied: false, already }; }
    let inserted = 0;
    for (const doc of plan.inserts) {
      const statement = bundleInsertOf(doc);
      if (!statement) throw Object.assign(new Error(`A planned record cannot land: ${doc.path}.`), { code: 'doc_unlandable', path: doc.path });
      await client.query(statement.text, statement.values);
      inserted++;
    }
    if (!already) {
      await client.query('INSERT INTO seed.crossings(manifest_hash, doc) VALUES ($1, $2::jsonb)', [incoming.manifestHash, JSON.stringify({
        sourceNodeLid: incoming.head.nodeLid, sourceDomain: incoming.head.domain, exportedAtMs: incoming.head.exportedAtMs, exportCommit: incoming.head.exportCommit,
        sealFingerprint: incoming.seal.fingerprint, destinationDigest: plan.destinationDigest, inserted, unchanged: plan.unchanged.length, rebuild: plan.rebuild.length,
      })]);
    }
    await client.query('COMMIT');
    return { plan, applied: true, inserted, already };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
