import { normalizePersonName } from './personName';

// A PUBLIC NAME (ring 2026-09-10). What the network may say about WHO did a thing. A being
// chooses whether its own name is spoken at all: anonymous, and only its tree speaks for it —
// the default tree, or the tree it acts as in context. Not anonymous, and its name stands,
// with its tree as the fallback when no name was ever written.
//
// Plain contract — guaranteed: publicNameOf never answers the person's name while `anonymous`
// stands; it answers the tree's name then, or null when there is no tree to speak. Not
// anonymous: the person's name, else the tree's, else null. showsPersonName says whether a
// person's own name may be shown beside their tree (the owner line, the reach envelope).
// Enforced by tests/publicName.test.ts. Not guaranteed: pulses already minted keep the
// authorName they were signed with — the chain remembers what was said, as they were then called.
export interface NamePresence {
  displayName?: string | null;
  anonymous?: boolean | null;
  treeName?: string | null;
}

export const publicNameOf = (p: NamePresence): string | null => {
  const tree = normalizePersonName(p.treeName) || null;
  if (p.anonymous) return tree;
  return normalizePersonName(p.displayName) || tree;
};

export const showsPersonName = (p: Pick<NamePresence, 'displayName' | 'anonymous'>): boolean =>
  !p.anonymous && normalizePersonName(p.displayName).length > 0;
