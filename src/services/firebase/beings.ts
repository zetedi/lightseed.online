import { getDocs, query, where, limit, doc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { db, mapDoc, mapPulse, lifetreesCollection, lightHousesCollection, visionsCollection, pulsesCollection } from './core';
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

export const findBeingByLid = async (lid: string, signedIn: boolean, viewer?: { uid?: string; isStaff?: boolean }): Promise<FoundBeing | null> => {
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
        if (d) {
            const lightHouse = mapDoc(d) as LightHouse;
            // The read rule is permissive for the signed-in; the fine gate is ours to keep:
            // a scanned QR shows what the scanner may see, and no more.
            const [memberLinks, shelterLinks] = await Promise.all([
                viewer?.uid ? getDocs(query(collection(db, 'links'), where('from', '==', viewer.uid), where('rel', '==', 'member'))).catch(() => null) : null,
                getDocs(query(collection(db, 'links'), where('from', '==', lightHouse.id), where('rel', '==', 'shelters'))).catch(() => null),
            ]);
            const memberCommunityIds = new Set((memberLinks?.docs || []).map(x => (x.data() as any).to as string));
            const homes = [...(lightHouse.communityId ? [lightHouse.communityId] : []), ...(shelterLinks?.docs || []).map(x => (x.data() as any).to as string)];
            if (!canViewLightHouse(lightHouse, { uid: viewer?.uid, isStaff: viewer?.isStaff, memberCommunityIds }, homes)) return null;
            return { kind: 'lightHouse', lightHouse };
        }
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

// Mint (or re-mint) a being's QR: persist the exact URL the code was generated with, so
// the app can tell a printed code from a moved domain and offer a refresh.
export const mintBeingQr = (
    collectionName: 'lifetrees' | 'lightHouses' | 'visions' | 'pulses',
    id: string,
    href: string,
) => updateDoc(doc(db, collectionName, id), { qr: { href }, updatedAt: serverTimestamp() });
