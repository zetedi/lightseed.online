import { getDocs, getDoc, query, where, limit, doc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, mapDoc, mapPulse, lifetreesCollection, lightHousesCollection, visionsCollection, pulsesCollection } from './core';
import type { Lifetree, Vision, Pulse, LightHouse } from '../../types';
import { canViewLightHouse } from '../../domain/lightHouse';

// Being resolution — the /b/<lid> door. A lid names exactly one being somewhere in the
// collections; we ask each in turn. Every query is wrapped: one the rules refuse (visibility
// gates the reader can't prove) resolves to nothing instead of failing the whole search —
// a QR scan shows what the scanner may see, and no more.

export type FoundBeing =
    | { kind: 'tree'; tree: Lifetree }
    | { kind: 'lightHouse'; lightHouse: LightHouse }
    | { kind: 'vision'; vision: Vision }
    | { kind: 'pulse'; pulse: Pulse };

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
    const memberCommunityIds = new Set((memberLinks?.docs || []).map(x => (x.data() as any).to as string));
    const homes = [...(lightHouse.communityId ? [lightHouse.communityId] : []), ...(shelterLinks?.docs || []).map(x => (x.data() as any).to as string)];
    if (!canViewLightHouse(lightHouse, { uid: viewer?.uid, isStaff: viewer?.isStaff, memberCommunityIds }, homes)) return null;
    return { kind: 'lightHouse', lightHouse };
};

// THE LID INDEX, read side (ring 2026-08-09): beings/{lid} says where the name lives, so the
// door opens with ONE read instead of eight queries. It is a finding aid and never an authority:
// a lid with no entry, an entry pointing at a document that is gone, or one the reader may not
// prove they can see all fall through to the search below. Emptying beings/ costs speed, nothing
// else. Returns undefined for "the index had nothing to say", null for "it said: not for you".
const throughIndex = async (
    lid: string,
    viewer?: { uid?: string; isStaff?: boolean },
): Promise<FoundBeing | null | undefined> => {
    let entry: { kind?: string; collection?: string; docId?: string } | undefined;
    try {
        entry = (await getDoc(doc(db, 'beings', lid))).data();
    } catch { return undefined; }
    if (!entry?.collection || !entry?.docId) return undefined;

    // Persons and communities are indexed (they own storage, and the door may one day open them)
    // but /b/ does not resolve them yet. Say so at once rather than searching for what we know
    // the search cannot find either.
    if (entry.kind === 'person' || entry.kind === 'community') return null;

    let snap;
    try {
        snap = await getDoc(doc(db, entry.collection, entry.docId));
    } catch { return undefined; } // refused: let the visibility-provable queries below try
    if (!snap.exists()) return undefined; // the address is stale — the search still knows the way

    switch (entry.kind) {
        case 'tree': return { kind: 'tree', tree: mapDoc(snap) as Lifetree };
        case 'vision': return { kind: 'vision', vision: mapDoc(snap) as Vision };
        case 'pulse': return { kind: 'pulse', pulse: mapPulse(snap) as Pulse };
        case 'lightHouse': return gateLightHouse(mapDoc(snap) as LightHouse, viewer);
        default: return undefined;
    }
};

export const findBeingByLid = async (lid: string, signedIn: boolean, viewer?: { uid?: string; isStaff?: boolean }): Promise<FoundBeing | null> => {
    const indexed = await throughIndex(lid, viewer);
    if (indexed !== undefined) return indexed;

    const byLid = where('lid', '==', lid);

    // Trees — bare query first (staff / permissive rules), then visibility-provable fallbacks.
    for (const q1 of [
        query(lifetreesCollection, byLid, limit(1)),
        query(lifetreesCollection, byLid, where('visibility', 'in', signedIn ? ['public', 'node'] : ['public']), limit(1)),
    ]) {
        const d = await tryOne(q1);
        if (d) return { kind: 'tree', tree: mapDoc(d) as Lifetree };
    }

    for (const q2 of [
        query(lightHousesCollection, byLid, limit(1)),
        query(lightHousesCollection, byLid, where('visibility', '==', 'public'), limit(1)),
    ]) {
        const d = await tryOne(q2);
        if (d) return gateLightHouse(mapDoc(d) as LightHouse, viewer);
    }

    for (const q3 of [
        query(visionsCollection, byLid, limit(1)),
        query(visionsCollection, byLid, where('visibility', 'in', signedIn ? ['public', 'node'] : ['public']), limit(1)),
    ]) {
        const d = await tryOne(q3);
        if (d) return { kind: 'vision', vision: mapDoc(d) as Vision };
    }

    for (const q4 of [
        query(pulsesCollection, byLid, limit(1)),
        query(pulsesCollection, byLid, where('visibility', 'in', signedIn ? ['public', 'node'] : ['public']), limit(1)),
    ]) {
        const d = await tryOne(q4);
        if (d) return { kind: 'pulse', pulse: mapPulse(d) as Pulse };
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
