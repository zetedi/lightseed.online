import {
  docContentHash, localUidCensus, travelRuleFor, verifyBundle, verifyBundleSeal,
  type BundleDoc, type BundleSealAnchor, type NodeBundle, type SealVerifier,
} from './bundle';
import { sha256 } from './chain/hash';
import { isLid } from './dataAuthority';

// An additive merge is a proposal, never an authority to write. The caller supplies a
// complete, consistent destination snapshot and an independently trusted custodian key.
// Identical paths are idempotent; different bytes require a human resolution. No last-write-
// wins, UID rewriting, staff-grant import or automatic chain-head advancement is performed here.
// Application must recheck destinationDigest inside its transaction before any insertion.
// This does NOT yet implement import execution, media transport or identity enrollment.
export interface MergeIdentity {
  sourceUid: string;
  targetUid: string;
  personLid: string;
}

export interface MergeIssue {
  code:
    | 'invalid_bundle' | 'untrusted_bundle' | 'invalid_document'
    | 'duplicate_destination' | 'content_conflict' | 'lid_conflict'
    | 'local_authority' | 'identity_unbound' | 'identity_conflict'
    | 'identity_rewrite_required';
  path?: string;
  detail: string;
}

export interface BundleMergePlan {
  // No planning conflicts; NOT authorization or proof that business-rule validation passed.
  ready: boolean;
  sourceManifestHash: string;
  destinationDigest: string;
  // Candidates are exposed even when blocked so the whole proposal can be inspected.
  // They must NEVER be applied if ready is false.
  inserts: BundleDoc[];
  unchanged: string[];
  rebuild: string[];
  issues: MergeIssue[];
}

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

// Bundle input must be JSON data. NaN, undefined, dates and SDK values are not transport
// values; accepting them would let a plan hash one value and JSON persistence store another.
const isJson = (value: unknown): boolean => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.every(isJson);
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  return Object.values(value).every(isJson);
};

const validDoc = (doc: BundleDoc): boolean => {
  if (!doc || typeof doc.path !== 'string') return false;
  const segments = doc.path.split('/');
  return segments.length >= 2 && segments.length % 2 === 0
    && segments.every(s => s.length > 0 && s !== '.' && s !== '..' && !/[\u0000-\u001f]/.test(s))
    && doc.data !== null && typeof doc.data === 'object'
    && !Array.isArray(doc.data) && isJson(doc.data);
};

// users/{uid} and persons/{uid} are two aspects of the same person, not a collision.
const lidAddress = (path: string): string =>
  /^(users|persons)\/[^/]+$/.test(path) ? `person/${path.split('/')[1]}` : path;

// The digest binds the entire snapshot, including node-local records that do not travel.
// An executor must compare it against the live transactional snapshot, not a client copy.
export const mergeSnapshotDigest = async (docs: readonly BundleDoc[]): Promise<string> => {
  const hashes = await Promise.all(docs.map(docContentHash));
  return sha256(`lightseed.merge.snapshot.v1|${hashes.sort().join('\n')}`);
};

export async function planBundleMerge(
  incoming: NodeBundle,
  destination: readonly BundleDoc[],
  anchor: BundleSealAnchor,
  verify: SealVerifier,
  identities: readonly MergeIdentity[] = [],
): Promise<BundleMergePlan> {
  const issues: MergeIssue[] = [];
  const inserts: BundleDoc[] = [];
  const unchanged: string[] = [];
  const rebuild: string[] = [];
  const result = (destinationDigest = ''): BundleMergePlan => ({
    ready: issues.length === 0, sourceManifestHash: incoming.manifestHash,
    destinationDigest, inserts, unchanged, rebuild, issues,
  });

  for (const doc of [...incoming.docs, ...destination]) {
    if (!validDoc(doc)) issues.push({ code: 'invalid_document', path: doc?.path, detail: 'Expected an even document path and plain JSON record.' });
  }
  if (issues.length) return result();

  const verdict = await verifyBundle(incoming);
  for (const issue of verdict.issues) {
    issues.push({ code: 'invalid_bundle', path: issue.path, detail: issue.code });
  }
  const sealIssue = await verifyBundleSeal(incoming, anchor, verify);
  if (sealIssue) issues.push({ code: 'untrusted_bundle', detail: sealIssue });
  if (issues.length) return result();

  const destinationDigest = await mergeSnapshotDigest(destination);
  const current = new Map<string, BundleDoc>();
  const lids = new Map<string, string>();
  const noteLid = (doc: BundleDoc) => {
    // Nested witnesses/signatures may name the signer's LID, not their own identity.
    // Check the top-level beings/relations; witness indexes also repeat subject LIDs.
    if (doc.path.split('/').length !== 2 || travelRuleFor(doc.path)?.mode === 'witness') return;
    const lid = doc.data.lid;
    if (typeof lid !== 'string' || !isLid(lid)) return;
    const address = lidAddress(doc.path);
    const existing = lids.get(lid);
    if (existing && existing !== address) {
      issues.push({ code: 'lid_conflict', path: doc.path, detail: `The same LID already names ${existing}.` });
    } else lids.set(lid, address);
  };
  for (const doc of destination) {
    if (current.has(doc.path)) issues.push({ code: 'duplicate_destination', path: doc.path, detail: 'Destination snapshot contains the path twice.' });
    current.set(doc.path, doc);
    noteLid(doc);
  }
  const incomingByPath = new Map(incoming.docs.map(doc => [doc.path, doc]));
  const bindings = new Map<string, MergeIdentity>();
  const targetBindings = new Map<string, string>();
  for (const binding of identities) {
    const previous = targetBindings.get(binding.targetUid);
    if (bindings.has(binding.sourceUid) || (previous !== undefined && previous !== binding.sourceUid)) {
      issues.push({ code: 'identity_conflict', detail: `Ambiguous identity binding for ${binding.sourceUid}.` });
    }
    bindings.set(binding.sourceUid, binding);
    targetBindings.set(binding.targetUid, binding.sourceUid);
  }
  for (const uid of localUidCensus(incoming.docs)) {
    const binding = bindings.get(uid);
    if (!binding) {
      issues.push({ code: 'identity_unbound', detail: `Identity ${uid} needs a verified local binding.` });
      continue;
    }
    if (binding.targetUid !== uid) {
      issues.push({ code: 'identity_rewrite_required', detail: `Identity ${uid} cannot be renamed inside signed history.` });
      continue;
    }
    const sourcePersons = ['users', 'persons'].map(c => incomingByPath.get(`${c}/${uid}`)).filter(d => d !== undefined);
    const targetPersons = ['users', 'persons'].map(c => current.get(`${c}/${uid}`)).filter(d => d !== undefined);
    if (!isLid(binding.personLid) || sourcePersons.length === 0 || targetPersons.length === 0
      || [...sourcePersons, ...targetPersons].some(d => d.data.lid !== binding.personLid)) {
      issues.push({ code: 'identity_conflict', detail: `Identity ${uid} is not anchored to the same person on both nodes.` });
    }
  }

  for (const doc of [...incoming.docs].sort((a, b) => compare(a.path, b.path))) {
    if (travelRuleFor(doc.path)?.mode === 'witness') {
      rebuild.push(doc.path);
      continue;
    }
    noteLid(doc);
    const existing = current.get(doc.path);
    if (existing && await docContentHash(existing) === await docContentHash(doc)) {
      unchanged.push(doc.path);
      continue;
    }
    // Configuration and staff roles are local decisions, even when importing into an
    // empty node. A trusted export signature is not a local authorization grant.
    if (/^(admins|config)\//.test(doc.path)) {
      issues.push({ code: 'local_authority', path: doc.path, detail: 'Local configuration and staff grants cannot be merged automatically.' });
    } else if (existing) {
      issues.push({ code: 'content_conflict', path: doc.path, detail: 'Existing content differs; neither record has been changed.' });
    } else {
      inserts.push(structuredClone(doc));
    }
  }
  return result(destinationDigest);
}
