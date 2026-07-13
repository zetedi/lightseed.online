import { getDocs, query, where, limit, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, mapDoc, mapPulse, lifetreesCollection, sanctuariesCollection, visionsCollection, pulsesCollection } from './core';
import type { Lifetree, Vision, Pulse, Sanctuary } from '../../types';

// Being resolution — the /b/<lid> door. A lid names exactly one being somewhere in the
// collections; we ask each in turn. Every query is wrapped: one the rules refuse (visibility
// gates the reader can't prove) resolves to nothing instead of failing the whole search —
// a QR scan shows what the scanner may see, and no more.

export type FoundBeing =
    | { kind: 'tree'; tree: Lifetree }
    | { kind: 'sanctuary'; sanctuary: Sanctuary }
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

export const findBeingByLid = async (lid: string, signedIn: boolean): Promise<FoundBeing | null> => {
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
        query(sanctuariesCollection, byLid, limit(1)),
        query(sanctuariesCollection, byLid, where('visibility', '==', 'public'), limit(1)),
    ]) {
        const d = await tryOne(q2);
        if (d) return { kind: 'sanctuary', sanctuary: mapDoc(d) as Sanctuary };
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
    collectionName: 'lifetrees' | 'sanctuaries' | 'visions' | 'pulses',
    id: string,
    href: string,
) => updateDoc(doc(db, collectionName, id), { qr: { href }, updatedAt: serverTimestamp() });
