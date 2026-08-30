// THE EXPORT CEREMONY — a being's data leaves in its own hands. An export GATHERS what the
// asking hand may already read (the rules stay the only law of sight; exporting adds no
// power), and it leaves whole: readable JSON, chains ordered oldest-first with their seals
// verbatim so any hand can re-verify them without this app, and the images the records
// point at. Person, tree, community, node — every being exports the same way.
//
// Plain contract: guaranteed now — chain blocks leave untransformed (only Stamps become
// ISO strings), linkage is measured and stated (linked / breaks), images are best-effort
// and the missing ones are NAMED in the manifest, never silently dropped. Not guaranteed —
// subcollections in a node export (loves, occupancy…) and storage files not referenced by
// a record; the manifest says what was not gathered.

// A Firestore Timestamp in flight ({ toMillis } live, { seconds, nanoseconds } raw) becomes
// an ISO string; everything else passes through, recursively. Pure, so exports are stable.
export const plainify = (value: unknown): unknown => {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value !== 'object') return value;
  const v = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
  if (typeof v.toMillis === 'function') return new Date(v.toMillis()).toISOString();
  if (typeof v.seconds === 'number' && typeof v.nanoseconds === 'number' && Object.keys(v).length === 2) {
    return new Date(v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6)).toISOString();
  }
  if (Array.isArray(value)) return value.map(plainify);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, x]) => [k, plainify(x)]));
};

// A tree's chain as it leaves: oldest first, seals verbatim, linkage measured. The caller
// hands the blocks in ANY order; blockHeight orders them (createdAt breaks ties for legacy
// blocks that carry none). `breaks` lists each index whose previousHash does not meet the
// hash before it — stated, never repaired: the export is a witness, not a mender.
export interface ChainExport {
  blocks: Record<string, unknown>[];
  linked: boolean;
  breaks: number[];
}

export const chainExport = (
  blocks: readonly { hash?: string; previousHash?: string; blockHeight?: number; createdAtMs?: number }[],
): ChainExport => {
  const ordered = [...blocks].sort((a, b) =>
    (a.blockHeight ?? 0) - (b.blockHeight ?? 0) || (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0));
  const breaks: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    if (!ordered[i].previousHash || !ordered[i - 1].hash || ordered[i].previousHash !== ordered[i - 1].hash) {
      breaks.push(i);
    }
  }
  return {
    blocks: ordered.map(b => plainify(b) as Record<string, unknown>),
    linked: breaks.length === 0,
    breaks,
  };
};

// Every image a set of records points at, deduplicated, each named for the archive. The
// fields are the repo's known image seats; an unfetchable URL later joins the manifest's
// missing list — the export never pretends completeness it did not achieve.
const IMAGE_FIELDS = ['imageUrl', 'latestGrowthUrl', 'photoURL', 'logoUrl', 'heroImageUrl'] as const;

export interface ImageEntry { url: string; name: string }

export const imageEntriesOf = (records: readonly unknown[]): ImageEntry[] => {
  const urls: string[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const rec = value as Record<string, unknown>;
    for (const field of IMAGE_FIELDS) {
      if (typeof rec[field] === 'string' && (rec[field] as string).startsWith('http')) urls.push(rec[field] as string);
    }
    if (Array.isArray(rec.imageUrls)) {
      for (const u of rec.imageUrls) if (typeof u === 'string' && u.startsWith('http')) urls.push(u);
    }
    Object.values(rec).forEach(walk);
  };
  records.forEach(walk);
  const seen = new Set<string>();
  return urls.filter(u => (seen.has(u) ? false : (seen.add(u), true))).map((url, i) => {
    const base = (url.split('?')[0].split('/').pop() || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    return { url, name: `${String(i + 1).padStart(3, '0')}-${base}` };
  });
};

// The archive's name: which being, whose name, which day.
export const exportFileName = (kind: 'person' | 'tree' | 'community' | 'node', name: string, whenMs: number): string => {
  const slug = (name || kind).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || kind;
  const d = new Date(whenMs);
  const day = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `lightseed-${kind}-${slug}-${day}.zip`;
};
