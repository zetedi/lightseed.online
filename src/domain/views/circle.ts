import type { Link } from '../link';
import type { TreeRelationRole } from '../treeCircle';

// A prism over the LIN: refract a tree's incoming links into role groups (+ the owner).
// Pure — no backend, no React. The proof that a view is a projection of the graph.
export interface CircleGroup {
  role: TreeRelationRole;
  members: string[]; // uids
}

const ROLE_ORDER: TreeRelationRole[] = ['owner', 'co_owner', 'guardian', 'steward', 'observer'];
const LINK_ROLES = new Set<string>(['co_owner', 'guardian', 'steward', 'observer']);

export function treeCircle(ownerId: string, links: Link[]): { groups: CircleGroup[]; size: number } {
  const byRole = new Map<TreeRelationRole, string[]>(ROLE_ORDER.map(r => [r, []]));
  if (ownerId) byRole.get('owner')!.push(ownerId);
  for (const l of links) {
    if (LINK_ROLES.has(l.rel)) byRole.get(l.rel as TreeRelationRole)!.push(l.from);
  }
  const groups = ROLE_ORDER
    .map(role => ({ role, members: byRole.get(role)! }))
    .filter(g => g.members.length > 0);
  const size = new Set(groups.flatMap(g => g.members).filter(Boolean)).size;
  return { groups, size };
}
