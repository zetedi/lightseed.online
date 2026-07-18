import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './core';
import { HOLD_TTL_MS, type Hold } from '../../domain/hold';

// The view-hold — a soft, self-expiring lock while a guest chooses nights (domain/hold.ts).
// Stored at lifetrees/{bedId}/holds/{uid}: each being writes ONLY its own hold doc (the rules
// bind holdUid == auth.uid), so "is someone else choosing?" is a client read (holdBlocks), not
// a hard gate. Expiry is a client wall-clock ms — a two-minute courtesy, never a boundary.

const holdRef = (bedId: string, uid: string) => doc(db, 'lifetrees', bedId, 'holds', uid);

export const placeHold = async (bedId: string, uid: string): Promise<void> => {
    await setDoc(holdRef(bedId, uid), { holderUid: uid, expiresAt: Date.now() + HOLD_TTL_MS });
};

export const releaseHold = async (bedId: string, uid: string): Promise<void> => {
    await deleteDoc(holdRef(bedId, uid)).catch(() => { /* a lapsed hold that's already gone is fine */ });
};

// Every hold on a bed; the caller filters to the active, other-held one via holdBlocks.
export const getBedHolds = async (bedId: string): Promise<Hold[]> =>
    (await getDocs(collection(db, 'lifetrees', bedId, 'holds'))).docs.map(d => {
        const x = d.data() as { holderUid?: string; expiresAt?: number };
        return { bedId, holderUid: x.holderUid || d.id, expiresAt: x.expiresAt || 0 };
    });
