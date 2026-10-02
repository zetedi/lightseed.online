import type { Store } from '../domain/store';
import type { Link, LinkRel } from '../domain/link';
import { db } from '../services/firebase';
import { collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { uuidv7 } from '../utils/id';
import { SECRET_LINKS, isSecretTree, mergeLinks } from '../domain/secretTree';

// The Firestore ADAPTER — now backed by the `links` collection (the LIN as data). The legacy
// arrays are gone from here; this is the only file that knows the persistence. The deterministic
// doc id `${from}__${rel}__${to}` makes writes idempotent and lets security rules exists()-check
// an edge with no query. Swap this file to swap the backend.
const linksCol = collection(db, 'links');
// The secret circle's ledger (domain/secretTree SECRET_LINKS): read by a secret tree's circle alone.
const secretLinksCol = collection(db, SECRET_LINKS);
const linkId = (from: string, rel: LinkRel, to: string) => `${from}__${rel}__${to}`;

export const firestoreStore: Store = {
  async linksTo(toId: string, rel?: LinkRel): Promise<Link[]> {
    const q = rel
      ? query(linksCol, where('to', '==', toId), where('rel', '==', rel))
      : query(linksCol, where('to', '==', toId));
    return (await getDocs(q)).docs.map(d => d.data() as Link);
  },

  async linksFrom(from: string, rel?: LinkRel): Promise<Link[]> {
    const q = rel
      ? query(linksCol, where('from', '==', from), where('rel', '==', rel))
      : query(linksCol, where('from', '==', from));
    return (await getDocs(q)).docs.map(d => d.data() as Link);
  },

  async secretLinksTo(treeId: string): Promise<Link[]> {
    return (await getDocs(query(secretLinksCol, where('to', '==', treeId)))).docs.map(d => d.data() as Link);
  },

  async secretLinksFrom(uid: string): Promise<Link[]> {
    return (await getDocs(query(secretLinksCol, where('from', '==', uid)))).docs.map(d => d.data() as Link);
  },

  async linksByRel(rel: LinkRel): Promise<Link[]> {
    return (await getDocs(query(linksCol, where('rel', '==', rel)))).docs.map(d => d.data() as Link);
  },

  async link(from: string, rel: LinkRel, to: string, extra?: Pick<Link, 'inviteId' | 'weight'>): Promise<void> {
    await setDoc(doc(db, 'links', linkId(from, rel, to)),
      { lid: uuidv7(), type: 'link', rel, from, to, ...(extra || {}), createdAt: serverTimestamp() });
  },

  async unlink(from: string, rel: LinkRel, to: string): Promise<void> {
    await deleteDoc(doc(db, 'links', linkId(from, rel, to)));
  },
};

// THE LINKS INTO A TREE — its circle and its other edges. A SECRET tree's keeper seats stand in
// `secretLinks` (domain/secretTree, the secret circle): read here beside the open LIN for a viewer
// the rules admit (its circle; anyone else is refused that ask, and it quietly yields nothing).
export const linksToTree = async (tree: { id: string; treeType?: string | null }): Promise<Link[]> => {
  const open = await firestoreStore.linksTo(tree.id);
  if (!isSecretTree(tree)) return open;
  return mergeLinks(open, await firestoreStore.secretLinksTo(tree.id).catch(() => [] as Link[]));
};
