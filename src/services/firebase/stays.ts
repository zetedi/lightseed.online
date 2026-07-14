import { addDoc, collection, getDocs, query, serverTimestamp, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, mapDoc } from './core';
import { uuidv7 } from '../../utils/id';
import { nightsBetween, type Stay, type StayStatus } from '../../domain/stay';
import type { Sanctuary } from '../../types';

// Stays — bed requests under a sanctuary's roof. The stay denormalises the keeper
// (hostUid) so the rules and the keeper's inbox query stand on plain fields.

const staysCollection = collection(db, 'stays');

export const requestStay = async (
    sanctuary: Sanctuary,
    guest: { uid: string; name?: string },
    draft: { fromDate: string; toDate: string; note?: string },
): Promise<string> => {
    const ref = await addDoc(staysCollection, {
        lid: uuidv7(),
        sanctuaryId: sanctuary.id,
        sanctuaryName: sanctuary.name,
        uid: guest.uid,
        guestName: guest.name || '',
        hostUid: sanctuary.ownerId || '',
        fromDate: draft.fromDate,
        toDate: draft.toDate,
        nights: nightsBetween(draft.fromDate, draft.toDate),
        note: draft.note || '',
        status: 'requested',
        createdAt: serverTimestamp(),
    });
    return ref.id;
};

// The keeper's view of a sanctuary's stays (their hostUid makes the query provable).
export const getStaysForHost = async (hostUid: string, sanctuaryId?: string): Promise<Stay[]> => {
    const q = sanctuaryId
        ? query(staysCollection, where('hostUid', '==', hostUid), where('sanctuaryId', '==', sanctuaryId))
        : query(staysCollection, where('hostUid', '==', hostUid));
    return (await getDocs(q)).docs.map(d => (mapDoc(d) as Stay));
};

// The guest's own requests.
export const getMyStays = async (uid: string, sanctuaryId?: string): Promise<Stay[]> => {
    const q = sanctuaryId
        ? query(staysCollection, where('uid', '==', uid), where('sanctuaryId', '==', sanctuaryId))
        : query(staysCollection, where('uid', '==', uid));
    return (await getDocs(q)).docs.map(d => (mapDoc(d) as Stay));
};

export const setStayStatus = (stayId: string, status: StayStatus) =>
    updateDoc(doc(db, 'stays', stayId), { status, updatedAt: serverTimestamp() });

export const withdrawStay = (stayId: string) => deleteDoc(doc(db, 'stays', stayId));
