import { addDoc, collection, getDocs, query, serverTimestamp, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, mapDoc } from './core';
import { uuidv7 } from '../../utils/id';
import { nightsBetween, type Stay, type StayStatus } from '../../domain/stay';
import type { Lifetree } from '../../types';

// Stays — a request to sleep in a specific BED (housed or loose). The stay denormalises the
// bed's keeper (hostUid) and the guest's chosen face (guestTree*) so the rules, the keeper's
// inbox, and the reservation card all stand on plain fields — the host can't read the guest's
// private profile. Availability itself is public and identity-free: it lives in the bed's
// occupancy subcollection, written by the Cloud Function when the keeper accepts.

const staysCollection = collection(db, 'stays');

export const requestStay = async (
    bed: Lifetree,
    guest: { uid: string; name?: string; tree?: { id: string; name?: string; growthUrl?: string } },
    draft: { fromDate: string; toDate: string; note?: string },
): Promise<string> => {
    const ref = await addDoc(staysCollection, {
        lid: uuidv7(),
        bedId: bed.id,
        bedName: bed.name || '',
        lightHouseId: bed.lightHouseId || '', // '' for a loose bed
        uid: guest.uid,
        guestName: guest.name || '',
        guestTreeId: guest.tree?.id || '',
        guestTreeName: guest.tree?.name || '',
        guestTreeGrowthUrl: guest.tree?.growthUrl || '',
        hostUid: bed.ownerId, // the rules verify this equals the bed's ownerId
        fromDate: draft.fromDate,
        toDate: draft.toDate,
        nights: nightsBetween(draft.fromDate, draft.toDate),
        note: draft.note || '',
        status: 'requested',
        createdAt: serverTimestamp(),
    });
    return ref.id;
};

// The keeper's view of ONE bed's stays — constrained by hostUid so the query is provable
// under the rules (only the host or the guest may read a stay).
export const getBedStaysForHost = async (bedId: string, hostUid: string): Promise<Stay[]> =>
    (await getDocs(query(staysCollection, where('bedId', '==', bedId), where('hostUid', '==', hostUid))))
        .docs.map(d => (mapDoc(d) as Stay));

// A guest's own requests for ONE bed (so they see their pending/accepted nights).
export const getMyBedStays = async (bedId: string, uid: string): Promise<Stay[]> =>
    (await getDocs(query(staysCollection, where('bedId', '==', bedId), where('uid', '==', uid))))
        .docs.map(d => (mapDoc(d) as Stay));

// PUBLIC availability — the bed's accepted date-ranges, no identity. Any signed-in being may
// read this to see busy/free nights; the full stays stay host/guest-only.
export const readBedOccupancy = async (bedId: string): Promise<{ fromDate: string; toDate: string }[]> =>
    (await getDocs(collection(db, 'lifetrees', bedId, 'occupancy'))).docs.map(d => {
        const x = d.data() as { fromDate?: string; toDate?: string };
        return { fromDate: x.fromDate || '', toDate: x.toDate || '' };
    });

// The keeper's whole-inbox view across all their beds (hostUid makes the query provable).
export const getStaysForHost = async (hostUid: string, lightHouseId?: string): Promise<Stay[]> => {
    const q = lightHouseId
        ? query(staysCollection, where('hostUid', '==', hostUid), where('lightHouseId', '==', lightHouseId))
        : query(staysCollection, where('hostUid', '==', hostUid));
    return (await getDocs(q)).docs.map(d => (mapDoc(d) as Stay));
};

// The guest's own requests across a house (kept for the guest's stay list).
export const getMyStays = async (uid: string, lightHouseId?: string): Promise<Stay[]> => {
    const q = lightHouseId
        ? query(staysCollection, where('uid', '==', uid), where('lightHouseId', '==', lightHouseId))
        : query(staysCollection, where('uid', '==', uid));
    return (await getDocs(q)).docs.map(d => (mapDoc(d) as Stay));
};

export const setStayStatus = (stayId: string, status: StayStatus) =>
    updateDoc(doc(db, 'stays', stayId), { status, updatedAt: serverTimestamp() });

export const withdrawStay = (stayId: string) => deleteDoc(doc(db, 'stays', stayId));
