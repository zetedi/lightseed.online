// WHICH DOOR A LINK WRITE GOES THROUGH ON THE INDEPENDENT NODE (ring 2026-11-17, the parity audit).
// The shell writes every relation through one port (`graphStore.link` / `unlink`). On the origin
// the rules judge each write where it lands. On the node the consent-bearing relations have their
// own commands — a community's door (join, ask, accept, decline, remove, leave, stewards), a
// tree's keeping knock — and the plain link command names none of them. Until this ring the
// node's store sent everything to the link command, so the community door and the tree's
// keeping knock were refused before they left the browser. This is the map from what the shell
// says to the command the node understands; the node still judges every one.
//
// `me` is the signed-in hand: the same relation is a different act when it is one's own (join,
// leave, withdraw) and when it is another's (accept, remove, decline).
// `toIsCommunity` matters only for the two relations that exist on both a community and a tree
// (`steward`, `keeper_request`); ask `needsTargetKind` first and read the target only then.

export type LinkRoute =
  | { door: 'link'; command: { action: 'link' | 'unlink'; from: string; rel: string; to: string } }
  | { door: 'community'; command: { action: string; id: string; member?: string } }
  | { door: 'tree'; command: { action: string; id: string; member?: string } };

export const needsTargetKind = (rel: string): boolean => rel === 'steward' || rel === 'keeper_request';

export function linkRouteOf(write: { action: 'link' | 'unlink'; from: string; rel: string; to: string; me: string | null; toIsCommunity?: boolean }): LinkRoute {
  const { action, from, rel, to, me } = write;
  const mine = !!me && from === me;
  const linking = action === 'link';
  const community = (act: string, withMember: boolean): LinkRoute => ({ door: 'community', command: { action: act, id: to, ...(withMember ? { member: from } : {}) } });
  const tree = (act: string, withMember: boolean): LinkRoute => ({ door: 'tree', command: { action: act, id: to, ...(withMember ? { member: from } : {}) } });

  if (rel === 'join_request') {
    // One's own knock is asked or withdrawn; another's can only be declined (a keeper never knocks for someone).
    if (linking) return mine ? community('request', false) : { door: 'link', command: { action, from, rel, to } };
    return mine ? community('cancel', false) : community('decline', true);
  }
  if (rel === 'member') {
    if (linking) return mine ? community('join', false) : community('accept', true);
    return mine ? community('leave', false) : community('remove', true);
  }
  if (rel === 'steward' && write.toIsCommunity) return community(linking ? 'grant_steward' : 'revoke_steward', true);
  if (rel === 'keeper_request') {
    const door = write.toIsCommunity ? community : tree;
    if (linking) return mine ? door('request_keeper', false) : { door: 'link', command: { action, from, rel, to } };
    return mine ? door('cancel_keeper_request', false) : door('decline_keeper_request', true);
  }
  // Everything else — and a tree's steward seat, which its holder lays down through the link
  // command — goes where it always went; the node's link command judges it.
  return { door: 'link', command: { action, from, rel, to } };
}
