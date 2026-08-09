import { isLid } from './dataAuthority';
import { spokenLine } from '../utils/translations';

// THE LID INDEX — where a true name is written down.
//
// A lid is portable: it belongs to the being, travels across nodes and years, and is never
// recycled, never renamed, never derived from a database id (LIN invariants). An address —
// a collection and a document id — is LOCAL: it belongs to whichever database happens to be
// holding the being today, and it dies with that database. Principle 11 says to separate the
// portable from the local, and this module is that separation made into a record:
//
//     beings/{lid}  ->  { kind, collection, docId }
//              ^                   ^
//              portable            local, replaceable
//
// Without it a lid is not ADDRESSED, it is SEARCHED FOR: findBeingByLid asks collection after
// collection until one answers. That is fine for a QR scan at human pace and wrong for anything
// that must resolve a name often or cheaply — the /b/<lid> door, a storage rule, an export, an
// import from another node. The index turns eight questions into one read, and gives the lid a
// home that survives the being's own document being moved.
//
// The index does not OWN anything. It is a finding aid: destroy it and every being still stands,
// still carries its lid, still resolves by the old search. That is deliberate — an index that
// beings depended on would have quietly become the authority, and identity belongs to beings.
//
// Pure: no Firestore, no clock. The service layer writes what this module says is lawful.

// The kinds a lid may address. Links, alignments and covenants carry lids too, but they name
// RELATIONS between beings rather than places a name is looked up — they are found through the
// beings they bind, and adding them here would index the whole graph to no one's benefit.
export type BeingKind = 'person' | 'tree' | 'vision' | 'lightHouse' | 'community' | 'pulse';

// A kind's local home. Stated once so an entry can never claim a tree lives among the visions:
// the index is the map, and a map that lies is worse than no map.
export const COLLECTION_FOR_KIND: Record<BeingKind, string> = {
  person: 'users',
  tree: 'lifetrees',
  vision: 'visions',
  lightHouse: 'lightHouses',
  community: 'communities',
  pulse: 'pulses',
};

export const isBeingKind = (value: unknown): value is BeingKind =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(COLLECTION_FOR_KIND, value);

// The map read the other way. A writer knows which collection it is standing in and nothing else,
// so this is the door every index write comes through: a collection the index does not address
// (links, alignments, covenants, invites, the mail queue) simply answers null and is let alone.
export const kindForCollection = (collection: string): BeingKind | null => {
  const found = (Object.keys(COLLECTION_FOR_KIND) as BeingKind[])
    .find(kind => COLLECTION_FOR_KIND[kind] === collection);
  return found ?? null;
};


// One entry. The document id IS the lid, so "one lid names one being" is not a rule anyone has
// to enforce — it is the shape of the thing.
export interface BeingEntry {
  lid: string;
  kind: BeingKind;
  collection: string;
  docId: string;
}

// Why this entry cannot stand, or null when it may. Firestore is an untyped boundary and an
// index is trusted by everything downstream, so a malformed entry is refused at the door rather
// than resolved later into a wrong being.
export const beingEntryProblem = (entry: Partial<BeingEntry> | null | undefined): string | null => {
  if (!entry || typeof entry !== 'object') return 'being_entry_nothing';
  if (!isLid(entry.lid)) return 'being_entry_lid';
  if (!isBeingKind(entry.kind)) return 'being_entry_kind';
  if (entry.collection !== COLLECTION_FOR_KIND[entry.kind]) {
    return spokenLine('being_entry_home', { kind: entry.kind, home: COLLECTION_FOR_KIND[entry.kind], claimed: entry.collection || '—' });
  }
  if (typeof entry.docId !== 'string' || !entry.docId.trim()) return 'being_entry_doc';
  return null;
};

export const isBeingEntry = (entry: unknown): entry is BeingEntry =>
  beingEntryProblem(entry as Partial<BeingEntry>) === null;

// The entry a document deserves, or null if it deserves none. Everything a writer knows — where
// it stands, which document, what true name the document carries — judged in ONE place, so the
// trigger, the backfill and any future importer can never disagree about what is indexable.
export const entryFor = (collection: string, docId: string, lid: unknown): BeingEntry | null => {
  const kind = kindForCollection(collection);
  if (!kind) return null;
  const entry: BeingEntry = { lid: String(lid ?? ''), kind, collection, docId };
  return beingEntryProblem(entry) ? null : entry;
};

// ── Re-pointing: the law that makes the lid portable ──────────────────────────────────────
// The lid and the kind are FROZEN — a name that could come to mean a different being would not
// be a name at all, and that is the invariant this whole file exists to hold. The ADDRESS is
// free to move, and must be: a being carried to another node, restored from an export, or
// rehoused by a migration is the SAME being at a new local address. Refusing that would make the
// index the thing that pins a being to one database — the exact opposite of its purpose.
export type RebindVerdict =
  | { verdict: 'unchanged' }
  | { verdict: 'moved'; from: string; to: string }
  | { verdict: 'refused'; reason: string };

const addressOf = (e: BeingEntry) => `${e.collection}/${e.docId}`;

export const rebindVerdict = (existing: BeingEntry, next: BeingEntry): RebindVerdict => {
  const problem = beingEntryProblem(next);
  if (problem) return { verdict: 'refused', reason: problem };
  if (existing.lid !== next.lid) return { verdict: 'refused', reason: 'rebind_different_name' };
  // A lid may never come to mean another kind of being — not by migration, not by repair.
  if (existing.kind !== next.kind) {
    return { verdict: 'refused', reason: spokenLine('rebind_kind_change', { from: existing.kind, to: next.kind }) };
  }
  if (addressOf(existing) === addressOf(next)) return { verdict: 'unchanged' };
  return { verdict: 'moved', from: addressOf(existing), to: addressOf(next) };
};

// ── The audit: two names for one being ────────────────────────────────────────────────────
// Firestore gives us "one lid, one entry" for free (the lid is the key) but nothing prevents the
// mirror fault: two DIFFERENT lids claiming the same local address. That is a being with two
// true names, which is a being whose identity has quietly split — the kind of corruption an
// import or a double-write makes, and the kind that is invisible until something disagrees.
export interface AddressCollision {
  address: string;
  lids: string[];
}

export const addressCollisions = (entries: BeingEntry[]): AddressCollision[] => {
  const byAddress = new Map<string, string[]>();
  for (const entry of entries) {
    const address = addressOf(entry);
    const lids = byAddress.get(address) || [];
    if (!lids.includes(entry.lid)) lids.push(entry.lid);
    byAddress.set(address, lids);
  }
  return [...byAddress.entries()]
    .filter(([, lids]) => lids.length > 1)
    .map(([address, lids]) => ({ address, lids: [...lids].sort() }));
};

export const indexIsSound = (entries: BeingEntry[]): boolean =>
  entries.every(isBeingEntry) && addressCollisions(entries).length === 0;

// ── Naming things by the true name ────────────────────────────────────────────────────────
// What the index is FOR, first use: media filed under the being that made it rather than under
// the auth account that happened to be signed in. `users/{uid}/…` and `communities/{docId}/…`
// name storage by the two least portable names in the system — an auth uid dies with its auth
// provider, a document id with its database — and storage is the part most likely to outlive
// both. Returns null rather than a path for a malformed lid, so a bad name can never open a
// storage prefix.
export const beingStoragePath = (lid: string, folder: string): string | null => {
  if (!isLid(lid)) return null;
  const clean = folder.trim().replace(/^\/+|\/+$/g, '');
  if (!clean || clean.includes('..')) return null;
  return `beings/${lid}/${clean}`;
};
