// THE LEAF OF A STAY (ring 2026-11-03): what a completed stay becomes on its bed's chain — the
// record the origin's mintStayLeaf (functions/lifetrees.ts) builds, pure. The guest's chosen tree
// face is the only name the leaf wears — never their human display name — and a guest who picked
// no tree stays "A guest": the node-visible chain must not become an identity-linked whereabouts
// record for a real coordinate.
//
// Plain contract — guaranteed: stayLeafIsDue answers exactly the origin's "accepted, not yet
// leafed, departed before today"; stayLeafRecordOf builds the origin's record field for field,
// so a leaf sealed here hashes as a leaf sealed there would. Enforced by tests/stayLeaf.test.ts
// and, end to end, tests/seed/clock.postgres-test.ts. Not guaranteed: the seal itself — the
// caller computes the canonical hash over this record and the soil re-checks the head.

// A stay as any soil stores it: the fields the leaf reads, and whatever else the record carries
// (the guest's human name among them — read by nothing here).
export interface StayLeafSource {
  uid?: unknown; bedId?: unknown; fromDate?: unknown; toDate?: unknown; status?: unknown; leafed?: unknown;
  guestTreeName?: unknown; guestTreeGrowthUrl?: unknown;
  [field: string]: unknown;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

// Departed before `today` (a yyyy-mm-dd in the node's zone), accepted, not yet leafed, on a bed.
export const stayLeafIsDue = (stay: StayLeafSource, today: string): boolean =>
  stay.status === 'accepted' && stay.leafed !== true && !!text(stay.bedId)
  && /^\d{4}-\d{2}-\d{2}$/.test(text(stay.toDate)) && /^\d{4}-\d{2}-\d{2}$/.test(today) && text(stay.toDate) < today;

// A bed's head as the origin reads it: the latest hash, else the genesis, else the root "0".
export const bedHeadOf = (bed: { latestHash?: unknown; genesisHash?: unknown }): string =>
  text(bed.latestHash) || text(bed.genesisHash) || '0';

export interface StayLeafRecord {
  lifetreeId: string; type: 'stay'; visibility: 'node'; title: string; body: string; authorId: string; authorName: string;
  imageUrl?: string; lid: string; id: string; loveCount: 0; commentCount: 0; mintedAt: number; previousHash: string; stayId: string;
}

export const stayLeafRecordOf = (p: { stayId: string; stay: StayLeafSource; id: string; lid: string; mintedAt: number; previousHash: string }): StayLeafRecord => {
  const face = text(p.stay.guestTreeName);
  const growth = text(p.stay.guestTreeGrowthUrl);
  return {
    lifetreeId: text(p.stay.bedId),
    type: 'stay',
    visibility: 'node',
    title: face || 'A guest',
    body: `stayed ${text(p.stay.fromDate)} → ${text(p.stay.toDate)}`,
    authorId: text(p.stay.uid),
    authorName: face,
    ...(growth ? { imageUrl: growth } : {}),
    lid: p.lid,
    id: p.id,
    loveCount: 0,
    commentCount: 0,
    mintedAt: p.mintedAt,
    previousHash: p.previousHash,
    stayId: p.stayId,
  };
};
