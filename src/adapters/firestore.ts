import type { Store } from '../domain/store';
import type { Link, LinkRel } from '../domain/link';
import { db } from '../../services/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

// The Firestore ADAPTER — the only place that knows both Firestore and the legacy shape. Each
// rel ↔ the legacy (collection, actor-array) it lives in, used on BOTH read and write, so the
// core + UI see the clean LIN without any data migration. When links become a real collection
// later, ONLY this file changes — core, projections, views and write call sites stay untouched.

const REL_TARGET: Record<LinkRel, { coll: string; field: string }> = {
  guardian: { coll: 'lifetrees', field: 'guardians' },
  co_owner: { coll: 'lifetrees', field: 'coOwnerIds' },
  steward:  { coll: 'lifetrees', field: 'stewardIds' },
  observer: { coll: 'lifetrees', field: 'observerIds' },
  member:   { coll: 'communities', field: 'memberIds' },
  joined:   { coll: 'visions', field: 'joinedUserIds' },
};
const TREE_RELS: LinkRel[] = ['co_owner', 'guardian', 'steward', 'observer'];

const toLinks = (rel: LinkRel, from: string[], to: string): Link[] =>
  from.filter(Boolean).map(f => ({ type: 'link', rel, from: f, to }));

export const firestoreStore: Store = {
  async linksTo(toId: string, rel?: LinkRel): Promise<Link[]> {
    if (rel) {
      const { coll, field } = REL_TARGET[rel];
      const snap = await getDoc(doc(db, coll, toId));
      return snap.exists() ? toLinks(rel, ((snap.data() as any)[field] || []) as string[], toId) : [];
    }
    // No rel → a lifetree's whole circle (all role arrays).
    const snap = await getDoc(doc(db, 'lifetrees', toId));
    if (!snap.exists()) return [];
    const data = snap.data() as any;
    return TREE_RELS.flatMap(r => toLinks(r, (data[REL_TARGET[r].field] || []) as string[], toId));
  },

  async link(from: string, rel: LinkRel, to: string): Promise<void> {
    const { coll, field } = REL_TARGET[rel];
    await updateDoc(doc(db, coll, to), { [field]: arrayUnion(from) });
  },

  async unlink(from: string, rel: LinkRel, to: string): Promise<void> {
    const { coll, field } = REL_TARGET[rel];
    await updateDoc(doc(db, coll, to), { [field]: arrayRemove(from) });
  },
};
