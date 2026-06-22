import type { Store } from '../domain/store';
import type { Link, LinkRel } from '../domain/link';
import { db } from '../../services/firebase';
import { collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { uuidv7 } from '../../utils/id';

// The Firestore ADAPTER — now backed by the `links` collection (the LIN as data). The legacy
// arrays are gone from here; this is the only file that knows the persistence. The deterministic
// doc id `${from}__${rel}__${to}` makes writes idempotent and lets security rules exists()-check
// an edge with no query. Swap this file to swap the backend.
const linksCol = collection(db, 'links');
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

  async linksByRel(rel: LinkRel): Promise<Link[]> {
    return (await getDocs(query(linksCol, where('rel', '==', rel)))).docs.map(d => d.data() as Link);
  },

  async link(from: string, rel: LinkRel, to: string): Promise<void> {
    await setDoc(doc(db, 'links', linkId(from, rel, to)),
      { lid: uuidv7(), type: 'link', rel, from, to, createdAt: serverTimestamp() });
  },

  async unlink(from: string, rel: LinkRel, to: string): Promise<void> {
    await deleteDoc(doc(db, 'links', linkId(from, rel, to)));
  },
};
