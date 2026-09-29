import type { Link } from '../link';
import type { TreeRelationRole } from '../treeCircle';

// A prism over the LIN: refract a tree's incoming links into role groups. The anchor
// (anchorUid) is a KEEPER like the rest (ring 2026-09-29) — listed first, but wearing no other
// mark; who planted is the history's to tell. Pure — no backend, no React.
export interface CircleGroup {
  role: TreeRelationRole;
  members: string[]; // uids
}

const ROLE_ORDER: TreeRelationRole[] = ['keeper', 'guardian', 'steward', 'observer'];
const LINK_ROLES = new Set<string>(['keeper', 'guardian', 'steward', 'observer']);

export function treeCircle(anchorUid: string, links: Link[]): { groups: CircleGroup[]; size: number } {
  const byRole = new Map<TreeRelationRole, string[]>(ROLE_ORDER.map(r => [r, []]));
  if (anchorUid) byRole.get('keeper')!.push(anchorUid);
  for (const l of links) {
    if (LINK_ROLES.has(l.rel) && !(l.rel === 'keeper' && l.from === anchorUid)) byRole.get(l.rel as TreeRelationRole)!.push(l.from);
  }
  const groups = ROLE_ORDER
    .map(role => ({ role, members: byRole.get(role)! }))
    .filter(g => g.members.length > 0);
  const size = new Set(groups.flatMap(g => g.members).filter(Boolean)).size;
  return { groups, size };
}
