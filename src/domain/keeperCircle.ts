// The keeper circle — a community is KEPT, and keeping can be shared, handed over, and
// asked for (ring 2026-08-12). The founding ownerId and every `keeper` link holder are FULL
// PEERS: one law (`isCommunityOwner` in the rules) grants them the same powers. Keepership
// is a burden, so it is never appointed — only offered (communityKeeperInvites, accepted by
// the invitee) or asked for (`keeper_request` links, answered by a sitting keeper) — and it
// is only ever minted server-side, after proving the newcomer has their own living tree:
// a keeper is a rooted being, not a bare account.
//
// THE ONE INVARIANT: a community is never keeperless. ownerId always names a real keeper,
// so a keeper-link holder may step down freely (ownerId remains), but the anchor holder
// resigns only through the server transaction that hands ownerId to a successor.
//
// Plain contract: guaranteed now — keeper links minted only by the server after the
// tree check; ownerId transfer only via resignKeeper (refuses when alone); peers cannot
// remove each other (self-resignation + staff only). Not guaranteed yet — nothing here
// signs the succession into a chain; the community doc's history is Firestore's, not a
// sealed story. Enforced by: firestore.rules isCommunityOwner + links clauses,
// functions/{acceptKeeperInvite, acceptKeeperRequest, resignKeeper}, and these laws' tests.

export interface KeeperLink {
  from: string;        // the keeper's uid
  createdAtMs: number; // when their keeping began (0 when the clock hasn't landed yet)
}

// Every keeper, distinct, the anchor first — the circle as the UI shows it.
export const keepersOf = (ownerId: string, keeperLinks: KeeperLink[]): string[] => {
  const out = [ownerId];
  for (const l of keeperLinks) if (!out.includes(l.from)) out.push(l.from);
  return out;
};

export const isKeeper = (uid: string, ownerId: string, keeperLinks: KeeperLink[]): boolean =>
  keepersOf(ownerId, keeperLinks).includes(uid);

// Resignation needs company: a keeper may step down only when at least one other remains.
export const canResign = (uid: string, ownerId: string, keeperLinks: KeeperLink[]): boolean => {
  const keepers = keepersOf(ownerId, keeperLinks);
  return keepers.includes(uid) && keepers.length >= 2;
};

// When the ANCHOR (ownerId) resigns, the longest-standing keeper inherits — deterministic:
// oldest link first, ties broken by uid so two replicas of this law always name one name.
export const successorAmong = (keeperLinks: KeeperLink[]): string | null => {
  if (keeperLinks.length === 0) return null;
  const sorted = [...keeperLinks].sort((a, b) =>
    a.createdAtMs - b.createdAtMs || (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  return sorted[0].from;
};

// May this being become a keeper? The refusal reasons the server (and the UI) both speak.
export type KeeperRefusal = 'no_tree' | 'already_keeper';

export const keeperRefusal = (facts: {
  ownsLivingTree: boolean;   // a LIFETREE or GUARDED tree of their own — beds don't root a being
  alreadyKeeper: boolean;
}): KeeperRefusal | null =>
  facts.alreadyKeeper ? 'already_keeper' : facts.ownsLivingTree ? null : 'no_tree';
