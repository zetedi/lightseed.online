import type { Store } from '../domain/store';
import type { Link, LinkRel } from '../domain/link';
import { getLifetreeById, db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

// The Firestore ADAPTER — the only place that knows both Firestore and the legacy shape.
// It maps each entity's legacy actor-arrays → Link[] on read (an anti-corruption layer), so
// the core + UI see the clean LIN without any data migration. When links become a real
// collection later, ONLY this file changes — core, projections and views stay untouched.

// rel → the lifetree role-array it derives from.
const TREE_ROLE_FIELDS: { rel: LinkRel; field: string }[] = [
  { rel: 'co_owner', field: 'coOwnerIds' },
  { rel: 'guardian', field: 'guardians' },
  { rel: 'steward', field: 'stewardIds' },
  { rel: 'observer', field: 'observerIds' },
];

// rels whose parent is NOT a lifetree: the collection + legacy array that holds the actors.
const NON_TREE: Partial<Record<LinkRel, { coll: string; field: string }>> = {
  joined: { coll: 'visions', field: 'joinedUserIds' },
  member: { coll: 'communities', field: 'memberIds' },
};

const toLinks = (rel: LinkRel, from: string[], to: string): Link[] =>
  from.filter(Boolean).map(f => ({ type: 'link', rel, from: f, to }));

export const firestoreStore: Store = {
  async linksTo(toId: string, rel?: LinkRel): Promise<Link[]> {
    // Non-tree rel (vision 'joined', community 'member'): one collection, one array.
    if (rel && NON_TREE[rel]) {
      const { coll, field } = NON_TREE[rel]!;
      const snap = await getDoc(doc(db, coll, toId));
      return snap.exists() ? toLinks(rel, ((snap.data() as any)[field] || []) as string[], toId) : [];
    }
    // Tree roles (or all of them when no rel is given): map the lifetree's role arrays.
    const tree = await getLifetreeById(toId);
    if (!tree) return [];
    const links: Link[] = [];
    for (const { rel: r, field } of TREE_ROLE_FIELDS) {
      if (rel && rel !== r) continue;
      links.push(...toLinks(r, ((tree as any)[field] || []) as string[], toId));
    }
    return links;
  },
};
