// THE MEDIA CROSSES (ring 2026-11-03): the pictures a node's records name travel beside the bundle — the
// SIDECAR: the content-addressed files (one per hash, shared by every manifest naming the same bytes)
// and their manifests (migration 019: path → {primary, small, large}). What travels is what the
// travelling records NAME (a door of this node, `/v1/media?path=…`, raw or encoded, anywhere in a
// record), never the store's whole contents: an unreferenced file is an orphan on both shores. The
// manifests' census — their count, the files' count, one digest over paths and manifests — is sealed
// INTO THE HEAD, so the custodian's seal covers the pictures too; each file is verified by its own
// name (sha256 = hash) before it lands, so no file can be swapped. A picture the records name but the
// store does not hold is named as left, never silently dropped. Between soils: the origin's pictures
// stay URLs into the origin's storage (a storage migration is its own ring); this law is node to node.
import { sha256 } from './chain/hash';
import { canonicalize } from './chain/canonical';
import { seedMediaReferencePath, seedMediaDescriptor } from './seedMedia.mjs';
import type { BundleDoc } from './bundle';

export interface MediaManifest { path: string; doc: Record<string, unknown> }
export interface MediaSidecar { manifests: MediaManifest[]; hashes: string[]; left: string[] }
export interface MediaHead { manifests: number; files: number; digest: string }
export interface MediaIssue { code: 'media_head_missing' | 'media_count' | 'media_digest' | 'media_file_missing' | 'media_manifest_unsound'; detail?: string }

const MEDIA_HASH_DOMAIN = 'lightseed.media.v1';
const KEYS = ['primary', 'small', 'large'] as const;

// Every media path the travelling records name, in any string field, however deep.
export const mediaReferencedBy = (docs: readonly BundleDoc[]): Set<string> => {
  const paths = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === 'string') { const path = seedMediaReferencePath(value); if (path) paths.add(path); return; }
    if (Array.isArray(value)) { for (const item of value) walk(item); return; }
    if (value && typeof value === 'object') for (const item of Object.values(value as Record<string, unknown>)) walk(item);
  };
  for (const doc of docs) walk(doc.data);
  return paths;
};

// The distinct files a set of manifests names, sorted; a manifest whose descriptors are unsound names nothing.
export const mediaHashesOf = (manifests: readonly MediaManifest[]): string[] => {
  const hashes = new Set<string>();
  for (const manifest of manifests) for (const key of KEYS) {
    const descriptor = manifest.doc[key];
    if (seedMediaDescriptor(descriptor)) hashes.add((descriptor as { hash: string }).hash);
  }
  return [...hashes].sort();
};

const manifestSound = (manifest: MediaManifest): boolean =>
  typeof manifest.path === 'string' && manifest.path.length > 0 && !!manifest.doc && typeof manifest.doc === 'object'
  && KEYS.every(key => seedMediaDescriptor(manifest.doc[key]));

// The sidecar for a set of travelling records: the referenced manifests, their files, and what is named but not held.
export const mediaSidecarOf = (manifests: readonly MediaManifest[], referenced: ReadonlySet<string>): MediaSidecar => {
  const held = new Map(manifests.filter(manifestSound).map(manifest => [manifest.path, manifest]));
  const travelling = [...referenced].filter(path => held.has(path)).sort().map(path => held.get(path) as MediaManifest);
  const left = [...referenced].filter(path => !held.has(path)).sort();
  return { manifests: travelling, hashes: mediaHashesOf(travelling), left };
};

// One digest over the manifests, in path order — the same on both shores, order-free by construction.
export const mediaDigestOf = (manifests: readonly MediaManifest[]): Promise<string> => {
  const lines = [...manifests].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map(manifest => `${JSON.stringify(manifest.path)}|${canonicalize(manifest.doc)}`);
  return sha256(`${MEDIA_HASH_DOMAIN}\n${lines.join('\n')}`);
};

export const mediaHeadOf = async (sidecar: MediaSidecar): Promise<MediaHead> =>
  ({ manifests: sidecar.manifests.length, files: sidecar.hashes.length, digest: await mediaDigestOf(sidecar.manifests) });

// The sidecar in the receiving hand, held to the sealed head and to every file's own name.
export const mediaSidecarIssues = async (
  head: MediaHead | null | undefined, manifests: readonly MediaManifest[], present: (hash: string) => Promise<boolean>,
): Promise<MediaIssue[]> => {
  const issues: MediaIssue[] = [];
  if (!head || typeof head !== 'object') return [{ code: 'media_head_missing', detail: 'the bundle was sealed without pictures' }];
  for (const manifest of manifests) if (!manifestSound(manifest)) issues.push({ code: 'media_manifest_unsound', detail: String(manifest?.path ?? '?') });
  if (issues.length) return issues;
  const hashes = mediaHashesOf(manifests);
  if (head.manifests !== manifests.length || head.files !== hashes.length) issues.push({ code: 'media_count', detail: `${head.manifests} manifests and ${head.files} files sealed, ${manifests.length} and ${hashes.length} beside the bundle` });
  if (head.digest !== await mediaDigestOf(manifests)) issues.push({ code: 'media_digest' });
  for (const hash of hashes) if (!(await present(hash))) issues.push({ code: 'media_file_missing', detail: hash });
  return issues;
};
