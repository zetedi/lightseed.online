import { getDocs, getDoc, query, where, limit, doc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, mapDoc, mapPulse, lifetreesCollection, lightHousesCollection, visionsCollection, pulsesCollection, communitiesCollection } from './core';
import type { Lifetree, Vision, Pulse, LightHouse, Link, Community } from '../../types';
import { canViewLightHouse } from '../../domain/lightHouse';
import { searchAfterIndex, type IndexWord, type SearchAsk } from '../../domain/beingIndex';

// Being resolution — the /b/<lid> door. A lid names exactly one being somewhere in the
// collections; the index says where (one read), and the search asks the collections only as
// far as the index's answer leaves open (domain/beingIndex searchAfterIndex). Every query is
// wrapped: one the rules refuse (visibility gates the reader can't prove) resolves to nothing
// instead of failing the whole search — a QR scan shows what the scanner may see, and no more.

export type FoundBeing =
    | { kind: 'tree'; tree: Lifetree }
    | { kind: 'lightHouse'; lightHouse: LightHouse }
    | { kind: 'vision'; vision: Vision }
    | { kind: 'pulse'; pulse: Pulse }
    | { kind: 'community'; community: Community };

const tryOne = async (q: ReturnType<typeof query>): Promise<any | null> => {
    try {
        const snap = await getDocs(q);
        return snap.docs[0] || null;
    } catch {
        return null;
    }
};

// A Light House answers to its community's choice as well as to the rules: the read rule is
// permissive for the signed-in, and the fine gate is ours to keep — a scanned QR shows what the
// scanner may see, and no more. Both doors below (index and search) come through here.
const gateLightHouse = async (
    lightHouse: LightHouse,
    viewer?: { uid?: string; isStaff?: boolean },
): Promise<FoundBeing | null> => {
    const [memberLinks, shelterLinks] = await Promise.all([
        viewer?.uid ? getDocs(query(collection(db, 'links'), where('from', '==', viewer.uid), where('rel', '==', 'member'))).catch(() => null) : null,
        getDocs(query(collection(db, 'links'), where('from', '==', lightHouse.id), where('rel', '==', 'shelters'))).catch(() => null),
    ]);
    const memberCommunityIds = new Set((memberLinks?.docs || []).map(x => (x.data() as Partial<Link>).to as string));
    const homes = [...(lightHouse.communityId ? [lightHouse.communityId] : []), ...(shelterLinks?.docs || []).map(x => (x.data() as Partial<Link>).to as string)];
    if (!canViewLightHouse(lightHouse, { uid: viewer?.uid, isStaff: viewer?.isStaff, memberCommunityIds }, homes)) return null;
    return { kind: 'lightHouse', lightHouse };
};

// What the index said, and what it opened.
interface IndexAnswer { word: IndexWord; found: FoundBeing | null }
const SILENT: IndexAnswer = { word: { word: 'silent' }, found: null };
const UNSEEN: IndexAnswer = { word: { word: 'unseen' }, found: null };

// THE LID INDEX, read side (ring 2026-08-09): beings/{lid} says where the name lives, so the
// door opens with ONE read instead of eight queries. It is a finding aid and never an authority:
// a lid with no entry or an entry pointing at a document that is gone leaves the search its
// full way (silent). One the RULES refuse (ring 2026-11-01) names its collection, so the search
// asks that collection once, bare, and nothing else — the pinned lists it would otherwise run
// are subsets of the get just refused. Emptying beings/ costs speed, nothing else.
const throughIndex = async (
    lid: string,
    viewer?: { uid?: string; isStaff?: boolean },
): Promise<IndexAnswer> => {
    let entry: { kind?: string; collection?: string; docId?: string } | undefined;
    try {
        entry = (await getDoc(doc(db, 'beings', lid))).data();
    } catch { return SILENT; }
    if (!entry?.collection || !entry?.docId) return SILENT;

    // Persons are indexed (they own storage, and the door may one day open them) but /b/ does
    // not resolve them yet. Say so at once rather than searching for what we know the search
    // cannot find either.
    if (entry.kind === 'person') return UNSEEN;

    let snap;
    try {
        snap = await getDoc(doc(db, entry.collection, entry.docId));
    } catch { return { word: { word: 'refused', collection: entry.collection }, found: null }; }
    if (!snap.exists()) return SILENT; // the address is stale — the search still knows the way

    const opened = (found: FoundBeing | null): IndexAnswer => (found ? { word: { word: 'found' }, found } : UNSEEN);
    switch (entry.kind) {
        case 'tree': return opened({ kind: 'tree', tree: mapDoc(snap) as Lifetree });
        case 'vision': return opened({ kind: 'vision', vision: mapDoc(snap) as Vision });
        case 'pulse': return opened({ kind: 'pulse', pulse: mapPulse(snap) as Pulse });
        case 'lightHouse': return opened(await gateLightHouse(mapDoc(snap) as LightHouse, viewer));
        // A community's door (ring 2026-11-01): CommunityMembers mints /b/<community lid>, and the
        // community is read by all — the door opens it as the /i/ door does.
        case 'community': return opened({ kind: 'community', community: mapDoc(snap) as Community });
        default: return SILENT;
    }
};

export const findBeingByLid = async (lid: string, signedIn: boolean, viewer?: { uid?: string; isStaff?: boolean }): Promise<FoundBeing | null> => {
    const answer = await throughIndex(lid, viewer);
    const asks = searchAfterIndex(answer.word);
    if (asks.length === 0) return answer.found;

    const byLid = where('lid', '==', lid);
    // The levels a reader can prove without the document's circle being read.
    const provable = signedIn ? ['public', 'node'] : ['public'];
    const ask = async ({ collection: name, pinned }: SearchAsk): Promise<FoundBeing | null> => {
        switch (name) {
            case 'lifetrees': {
                const d = await tryOne(pinned ? query(lifetreesCollection, byLid, where('visibility', 'in', provable), limit(1)) : query(lifetreesCollection, byLid, limit(1)));
                return d ? { kind: 'tree', tree: mapDoc(d) as Lifetree } : null;
            }
            case 'lightHouses': {
                const d = await tryOne(pinned ? query(lightHousesCollection, byLid, where('visibility', '==', 'public'), limit(1)) : query(lightHousesCollection, byLid, limit(1)));
                return d ? gateLightHouse(mapDoc(d) as LightHouse, viewer) : null;
            }
            case 'visions': {
                const d = await tryOne(pinned ? query(visionsCollection, byLid, where('visibility', 'in', provable), limit(1)) : query(visionsCollection, byLid, limit(1)));
                return d ? { kind: 'vision', vision: mapDoc(d) as Vision } : null;
            }
            case 'pulses': {
                const d = await tryOne(pinned ? query(pulsesCollection, byLid, where('visibility', 'in', provable), limit(1)) : query(pulsesCollection, byLid, limit(1)));
                return d ? { kind: 'pulse', pulse: mapPulse(d) as Pulse } : null;
            }
            case 'communities': {
                const d = await tryOne(query(communitiesCollection, byLid, limit(1)));
                return d ? { kind: 'community', community: mapDoc(d) as Community } : null;
            }
        }
    };
    for (const a of asks) {
        const hit = await ask(a);
        if (hit) return hit;
    }
    return null;
};

// THE LID INDEX BACKFILL — every being born before the triggers existed still has a true name
// and no entry (ring 2026-08-09). Staff only (the callable refuses everyone else), idempotent,
// safe to re-run. Dry by default: `apply` false counts what WOULD be written and changes nothing.
// It never re-points an existing entry — a lid already written that disagrees is REPORTED, since
// moving a name is a governed act and not a sweep's side effect.
export interface LidIndexReport {
    apply: boolean;
    wrote: number;
    nameless: number;
    disagreements: { lid: string; existing: string; found: string }[];
    collisions: { address: string; lids: string[] }[];
}

export const backfillLidIndex = async (apply = false): Promise<LidIndexReport> => {
    const fn = httpsCallable(functions, 'backfillLidIndex');
    const res = await fn({ apply });
    return res.data as LidIndexReport;
};

// Mint (or re-mint) a being's QR: persist the exact URL the code was generated with, so
// the app can tell a printed code from a moved domain and offer a refresh.
export const mintBeingQr = (
    collectionName: 'lifetrees' | 'lightHouses' | 'visions' | 'pulses',
    id: string,
    href: string,
) => updateDoc(doc(db, collectionName, id), { qr: { href }, updatedAt: serverTimestamp() });
